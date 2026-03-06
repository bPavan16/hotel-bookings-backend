import express from "express";
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Room, Booking, Hotel } from "../config/database.js";
import { publishEvent } from "../config/kafka.js";
import { getRedisClient } from "../config/redis.js";

const router = express.Router();

const bookingSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
  roomId: Joi.number().integer().positive().required(),
  checkInDate: Joi.date().iso().min("now").required(),
  checkOutDate: Joi.date().iso().greater(Joi.ref("checkInDate")).required(),
  numGuests: Joi.number().integer().positive().required(),
  specialRequests: Joi.string().optional(),
});

// -- POST /  (create booking) --------------------------------------------------
router.post("/", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      await t.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      userId,
      roomId,
      checkInDate,
      checkOutDate,
      numGuests,
      specialRequests,
    } = value;

    // Check room existence and availability
    const room = await Room.findOne({
      where: { id: roomId, is_available: true },
      transaction: t,
    });
    if (!room) {
      await t.rollback();
      return res.status(404).json({ error: "Room not found or not available" });
    }

    // Check for conflicting bookings
    const conflict = await Booking.findOne({
      where: {
        room_id: roomId,
        status: { [Op.notIn]: ["cancelled", "completed"] },
        [Op.or]: [
          {
            check_in_date: { [Op.lte]: checkInDate },
            check_out_date: { [Op.gt]: checkInDate },
          },
          {
            check_in_date: { [Op.lt]: checkOutDate },
            check_out_date: { [Op.gte]: checkOutDate },
          },
          {
            check_in_date: { [Op.gte]: checkInDate },
            check_out_date: { [Op.lte]: checkOutDate },
          },
        ],
      },
      transaction: t,
    });

    if (conflict) {
      await t.rollback();
      return res
        .status(409)
        .json({ error: "Room is not available for selected dates" });
    }

    // Calculate total price
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * parseFloat(room.price_per_night);

    const booking = await Booking.create(
      {
        user_id: userId,
        room_id: roomId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        total_price: totalPrice,
        num_guests: numGuests,
        special_requests: specialRequests,
        status: "pending",
      },
      { transaction: t },
    );

    await t.commit();

    // Publish event
    await publishEvent("booking-created", {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalPrice: booking.total_price,
      numGuests: booking.num_guests,
      status: booking.status,
      timestamp: new Date().toISOString(),
    });

    // Invalidate cache
    const redis = getRedisClient();
    await redis.del(`user:${userId}:bookings`);

    res.status(201).json({
      message: "Booking created successfully",
      booking: {
        id: booking.id,
        userId: booking.user_id,
        roomId: booking.room_id,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        totalPrice: booking.total_price,
        numGuests: booking.num_guests,
        status: booking.status,
        nights,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Create booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// -- GET /  (list bookings for a user) ----------------------------------------
router.get("/", async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const cacheKey = `user:${userId}:bookings:${status || "all"}:${page}:${limit}`;
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = { user_id: userId };
    if (status) where.status = status;

    const bookings = await Booking.findAll({
      where,
      include: [
        {
          model: Room,
          as: "room",
          attributes: ["room_number", "room_type", "price_per_night"],
          include: [
            {
              model: Hotel,
              as: "hotel",
              attributes: ["name", "city", "country"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    const response = {
      bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit) },
    };

    await redis.setEx(cacheKey, 300, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// -- GET /:id ------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: "room",
          attributes: ["room_number", "room_type", "price_per_night"],
          include: [
            {
              model: Hotel,
              as: "hotel",
              attributes: ["name", "address", "city", "country"],
            },
          ],
        },
      ],
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ booking });
  } catch (error) {
    console.error("Get booking error:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// -- PUT /:id/status -----------------------------------------------------------
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    await booking.update({ status });

    await publishEvent("booking-status-updated", {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      status: booking.status,
      timestamp: new Date().toISOString(),
    });

    const redis = getRedisClient();
    await redis.del(`user:${booking.user_id}:bookings`);

    res.json({ message: "Booking status updated successfully", booking });
  } catch (error) {
    console.error("Update booking status error:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// -- PUT /:id/cancel -----------------------------------------------------------
router.put("/:id/cancel", async (req, res) => {
  try {
    const booking = await Booking.findOne({
      where: {
        id: req.params.id,
        status: { [Op.in]: ["pending", "confirmed"] },
      },
    });

    if (!booking)
      return res
        .status(404)
        .json({ error: "Booking not found or cannot be cancelled" });

    await booking.update({ status: "cancelled" });

    await publishEvent("booking-cancelled", {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      totalPrice: booking.total_price,
      timestamp: new Date().toISOString(),
    });

    const redis = getRedisClient();
    await redis.del(`user:${booking.user_id}:bookings`);

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;
