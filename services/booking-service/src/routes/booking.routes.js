const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { publishEvent } = require('../config/kafka');
const { getRedisClient } = require('../config/redis');

const router = express.Router();

const bookingSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
  roomId: Joi.number().integer().positive().required(),
  checkInDate: Joi.date().iso().min('now').required(),
  checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required(),
  numGuests: Joi.number().integer().positive().required(),
  specialRequests: Joi.string().optional()
});

// Create new booking
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { userId, roomId, checkInDate, checkOutDate, numGuests, specialRequests } = value;

    await client.query('BEGIN');

    // Check if room exists and is available
    const roomResult = await client.query(
      'SELECT * FROM rooms WHERE id = $1 AND is_available = true',
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found or not available' });
    }

    const room = roomResult.rows[0];

    // Check for conflicting bookings
    const conflictResult = await client.query(
      `SELECT id FROM bookings 
       WHERE room_id = $1 
       AND status NOT IN ('cancelled', 'completed')
       AND (
         (check_in_date <= $2 AND check_out_date > $2) OR
         (check_in_date < $3 AND check_out_date >= $3) OR
         (check_in_date >= $2 AND check_out_date <= $3)
       )`,
      [roomId, checkInDate, checkOutDate]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Room is not available for selected dates' });
    }

    // Calculate total price
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const totalPrice = nights * parseFloat(room.price_per_night);

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_price, num_guests, special_requests, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') 
       RETURNING *`,
      [userId, roomId, checkInDate, checkOutDate, totalPrice, numGuests, specialRequests]
    );

    await client.query('COMMIT');

    const booking = bookingResult.rows[0];

    // Publish booking created event to Kafka
    await publishEvent('booking-created', {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalPrice: booking.total_price,
      numGuests: booking.num_guests,
      status: booking.status,
      timestamp: new Date().toISOString()
    });

    // Invalidate cache
    const redis = getRedisClient();
    await redis.del(`user:${userId}:bookings`);

    res.status(201).json({
      message: 'Booking created successfully',
      booking: {
        id: booking.id,
        userId: booking.user_id,
        roomId: booking.room_id,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        totalPrice: booking.total_price,
        numGuests: booking.num_guests,
        status: booking.status,
        nights
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// Get all bookings for a user
router.get('/', async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const cacheKey = `user:${userId}:bookings:${status || 'all'}:${page}:${limit}`;

    // Check cache
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = `
      SELECT b.*, r.room_number, r.room_type, r.price_per_night, h.name as hotel_name, h.city, h.country
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN hotels h ON r.hotel_id = h.id
      WHERE b.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    const response = {
      bookings: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };

    // Cache the result
    await redis.setEx(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT b.*, r.room_number, r.room_type, r.price_per_night, h.name as hotel_name, h.address, h.city, h.country
       FROM bookings b
       JOIN rooms r ON b.room_id = r.id
       JOIN hotels h ON r.hotel_id = h.id
       WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ booking: result.rows[0] });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Update booking status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    // Publish status update event
    await publishEvent('booking-status-updated', {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      status: booking.status,
      timestamp: new Date().toISOString()
    });

    // Invalidate cache
    const redis = getRedisClient();
    await redis.del(`user:${booking.user_id}:bookings`);

    res.json({
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// Cancel booking
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND status IN ('pending', 'confirmed')
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or cannot be cancelled' });
    }

    const booking = result.rows[0];

    // Publish cancellation event
    await publishEvent('booking-cancelled', {
      id: booking.id,
      userId: booking.user_id,
      roomId: booking.room_id,
      totalPrice: booking.total_price,
      timestamp: new Date().toISOString()
    });

    // Invalidate cache
    const redis = getRedisClient();
    await redis.del(`user:${booking.user_id}:bookings`);

    res.json({
      message: 'Booking cancelled successfully',
      booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
