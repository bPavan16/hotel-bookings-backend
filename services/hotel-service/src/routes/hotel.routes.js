import express from "express";
import Joi from "joi";
import { Op } from "sequelize";
import { Hotel, Room } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";

const router = express.Router();
const CACHE_TTL = 3600;

// Validation schemas
const hotelSchema = Joi.object({
  name: Joi.string().min(3).required(),
  description: Joi.string().optional(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  country: Joi.string().required(),
  rating: Joi.number().min(0).max(5).optional(),
  amenities: Joi.array().items(Joi.string()).optional(),
  images: Joi.array().items(Joi.string()).optional(),
});

const roomSchema = Joi.object({
  roomNumber: Joi.string().required(),
  roomType: Joi.string().required(),
  description: Joi.string().optional(),
  pricePerNight: Joi.number().positive().required(),
  capacity: Joi.number().integer().positive().required(),
  amenities: Joi.array().items(Joi.string()).optional(),
  images: Joi.array().items(Joi.string()).optional(),
  isAvailable: Joi.boolean().optional(),
});

// -- GET /  (list hotels with filtering & pagination) -------------------------
router.get("/", async (req, res) => {
  try {
    const { city, country, minRating, page = 1, limit = 10 } = req.query;

    const cacheKey = `hotels:${city || "all"}:${country || "all"}:${minRating || "all"}:${page}:${limit}`;
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = {};
    if (city) where.city = { [Op.iLike]: `%${city}%` };
    if (country) where.country = { [Op.iLike]: `%${country}%` };
    if (minRating) where.rating = { [Op.gte]: parseFloat(minRating) };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: hotels } = await Hotel.findAndCountAll({
      where,
      order: [["rating", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    const response = {
      hotels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    };

    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error("Get hotels error:", error);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
});

// -- GET /:id ------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `hotel:${id}`;

    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const hotel = await Hotel.findByPk(id);
    if (!hotel) return res.status(404).json({ error: "Hotel not found" });

    const payload = { hotel };
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    res.json(payload);
  } catch (error) {
    console.error("Get hotel error:", error);
    res.status(500).json({ error: "Failed to fetch hotel" });
  }
});

// -- POST / --------------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { error, value } = hotelSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      name,
      description,
      address,
      city,
      country,
      rating,
      amenities,
      images,
    } = value;

    const hotel = await Hotel.create({
      name,
      description,
      address,
      city,
      country,
      rating: rating || 0,
      amenities: amenities || [],
      images: images || [],
    });

    // Invalidate hotel list cache
    const redis = getRedisClient();
    const keys = await redis.keys("hotels:*");
    if (keys.length > 0) await redis.del(keys);

    res.status(201).json({ message: "Hotel created successfully", hotel });
  } catch (error) {
    console.error("Create hotel error:", error);
    res.status(500).json({ error: "Failed to create hotel" });
  }
});

// -- GET /:id/rooms ------------------------------------------------------------
router.get("/:id/rooms", async (req, res) => {
  try {
    const { id } = req.params;
    const { roomType, minPrice, maxPrice, available } = req.query;

    const cacheKey = `hotel:${id}:rooms:${roomType || "all"}:${minPrice || "all"}:${maxPrice || "all"}:${available || "all"}`;
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = { hotel_id: id };
    if (roomType) where.room_type = { [Op.iLike]: `%${roomType}%` };
    if (minPrice)
      where.price_per_night = {
        ...(where.price_per_night || {}),
        [Op.gte]: parseFloat(minPrice),
      };
    if (maxPrice)
      where.price_per_night = {
        ...(where.price_per_night || {}),
        [Op.lte]: parseFloat(maxPrice),
      };
    if (available === "true") where.is_available = true;

    const rooms = await Room.findAll({
      where,
      order: [["price_per_night", "ASC"]],
    });

    const response = { rooms };
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// -- POST /:id/rooms -----------------------------------------------------------
router.post("/:id/rooms", async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = roomSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const {
      roomNumber,
      roomType,
      description,
      pricePerNight,
      capacity,
      amenities,
      images,
      isAvailable,
    } = value;

    const room = await Room.create({
      hotel_id: id,
      room_number: roomNumber,
      room_type: roomType,
      description,
      price_per_night: pricePerNight,
      capacity,
      amenities: amenities || [],
      images: images || [],
      is_available: isAvailable !== false,
    });

    // Invalidate room cache
    const redis = getRedisClient();
    const keys = await redis.keys(`hotel:${id}:rooms:*`);
    if (keys.length > 0) await redis.del(keys);

    res.status(201).json({ message: "Room created successfully", room });
  } catch (error) {
    console.error("Create room error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ error: "Room number already exists for this hotel" });
    }
    res.status(500).json({ error: "Failed to create room" });
  }
});

// -- GET /:hotelId/rooms/:roomId -----------------------------------------------
router.get("/:hotelId/rooms/:roomId", async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;
    const cacheKey = `hotel:${hotelId}:room:${roomId}`;

    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const room = await Room.findOne({
      where: { id: roomId, hotel_id: hotelId },
    });
    if (!room) return res.status(404).json({ error: "Room not found" });

    const payload = { room };
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));
    res.json(payload);
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

export default router;
