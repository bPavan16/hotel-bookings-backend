import express from "express";
import Joi from "joi";
import { pool } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";

const router = express.Router();

const CACHE_TTL = 3600; // 1 hour

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

// Get all hotels with optional filtering
router.get("/", async (req, res) => {
  try {
    const { city, country, minRating, page = 1, limit = 10 } = req.query;

    const cacheKey = `hotels:${city || "all"}:${country || "all"}:${minRating || "all"}:${page}:${limit}`;

    // Check cache
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = "SELECT * FROM hotels WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (city) {
      query += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (country) {
      query += ` AND country ILIKE $${paramIndex}`;
      params.push(`%${country}%`);
      paramIndex++;
    }

    if (minRating) {
      query += ` AND rating >= $${paramIndex}`;
      params.push(minRating);
      paramIndex++;
    }

    query += ` ORDER BY rating DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = "SELECT COUNT(*) FROM hotels WHERE 1=1";
    const countParams = [];
    let countParamIndex = 1;

    if (city) {
      countQuery += ` AND city ILIKE $${countParamIndex}`;
      countParams.push(`%${city}%`);
      countParamIndex++;
    }

    if (country) {
      countQuery += ` AND country ILIKE $${countParamIndex}`;
      countParams.push(`%${country}%`);
      countParamIndex++;
    }

    if (minRating) {
      countQuery += ` AND rating >= $${countParamIndex}`;
      countParams.push(minRating);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const response = {
      hotels: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error("Get hotels error:", error);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
});

// Get hotel by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `hotel:${id}`;

    // Check cache
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query("SELECT * FROM hotels WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found" });
    }

    const hotel = result.rows[0];

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ hotel }));

    res.json({ hotel });
  } catch (error) {
    console.error("Get hotel error:", error);
    res.status(500).json({ error: "Failed to fetch hotel" });
  }
});

// Create new hotel
router.post("/", async (req, res) => {
  try {
    const { error, value } = hotelSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

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

    const result = await pool.query(
      `INSERT INTO hotels (name, description, address, city, country, rating, amenities, images) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        name,
        description,
        address,
        city,
        country,
        rating || 0,
        JSON.stringify(amenities || []),
        JSON.stringify(images || []),
      ],
    );

    // Invalidate cache
    const redis = getRedisClient();
    const keys = await redis.keys("hotels:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }

    res.status(201).json({
      message: "Hotel created successfully",
      hotel: result.rows[0],
    });
  } catch (error) {
    console.error("Create hotel error:", error);
    res.status(500).json({ error: "Failed to create hotel" });
  }
});

// Get rooms for a hotel
router.get("/:id/rooms", async (req, res) => {
  try {
    const { id } = req.params;
    const { roomType, minPrice, maxPrice, available } = req.query;

    const cacheKey = `hotel:${id}:rooms:${roomType || "all"}:${minPrice || "all"}:${maxPrice || "all"}:${available || "all"}`;

    // Check cache
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = "SELECT * FROM rooms WHERE hotel_id = $1";
    const params = [id];
    let paramIndex = 2;

    if (roomType) {
      query += ` AND room_type ILIKE $${paramIndex}`;
      params.push(`%${roomType}%`);
      paramIndex++;
    }

    if (minPrice) {
      query += ` AND price_per_night >= $${paramIndex}`;
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice) {
      query += ` AND price_per_night <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    if (available === "true") {
      query += ` AND is_available = true`;
    }

    query += " ORDER BY price_per_night ASC";

    const result = await pool.query(query, params);

    const response = { rooms: result.rows };

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Create room for a hotel
router.post("/:id/rooms", async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = roomSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

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

    const result = await pool.query(
      `INSERT INTO rooms (hotel_id, room_number, room_type, description, price_per_night, capacity, amenities, images, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        id,
        roomNumber,
        roomType,
        description,
        pricePerNight,
        capacity,
        JSON.stringify(amenities || []),
        JSON.stringify(images || []),
        isAvailable !== false,
      ],
    );

    // Invalidate cache
    const redis = getRedisClient();
    const keys = await redis.keys(`hotel:${id}:rooms:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }

    res.status(201).json({
      message: "Room created successfully",
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Create room error:", error);
    if (error.code === "23505") {
      // Unique violation
      res
        .status(400)
        .json({ error: "Room number already exists for this hotel" });
    } else {
      res.status(500).json({ error: "Failed to create room" });
    }
  }
});

// Get specific room
router.get("/:hotelId/rooms/:roomId", async (req, res) => {
  try {
    const { hotelId, roomId } = req.params;

    const cacheKey = `hotel:${hotelId}:room:${roomId}`;

    // Check cache
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      "SELECT * FROM rooms WHERE id = $1 AND hotel_id = $2",
      [roomId, hotelId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = result.rows[0];

    // Cache the result
    await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ room }));

    res.json({ room });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

export default router;
