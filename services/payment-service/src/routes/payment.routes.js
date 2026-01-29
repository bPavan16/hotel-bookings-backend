const express = require('express');
const Joi = require('joi');
const { pool } = require('../config/database');
const { publishEvent } = require('../config/kafka');

const router = express.Router();

const paymentSchema = Joi.object({
  bookingId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('credit_card', 'debit_card', 'paypal', 'stripe').required(),
  cardNumber: Joi.string().optional(),
  cardHolderName: Joi.string().optional(),
  expiryDate: Joi.string().optional(),
  cvv: Joi.string().optional()
});

// Process payment
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { bookingId, amount, paymentMethod } = value;

    await client.query('BEGIN');

    // Check if booking exists
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Verify amount matches booking total
    if (parseFloat(amount) !== parseFloat(booking.total_price)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment amount does not match booking total' });
    }

    // Simulate payment processing (in real app, integrate with payment gateway)
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const paymentStatus = 'completed'; // Simulate successful payment

    // Update or create payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (booking_id, amount, payment_method, payment_status, transaction_id, payment_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (booking_id) 
       DO UPDATE SET 
         amount = EXCLUDED.amount,
         payment_method = EXCLUDED.payment_method,
         payment_status = EXCLUDED.payment_status,
         transaction_id = EXCLUDED.transaction_id,
         payment_date = CURRENT_TIMESTAMP
       RETURNING *`,
      [bookingId, amount, paymentMethod, paymentStatus, transactionId]
    );

    // Update booking status to confirmed
    await client.query(
      `UPDATE bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [bookingId]
    );

    await client.query('COMMIT');

    const payment = paymentResult.rows[0];

    // Publish payment processed event
    await publishEvent('payment-processed', {
      id: payment.id,
      bookingId: payment.booking_id,
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.payment_status,
      transactionId: payment.transaction_id,
      timestamp: new Date().toISOString()
    });

    // Publish notification event
    await publishEvent('notification-request', {
      type: 'payment-success',
      userId: booking.user_id,
      bookingId: booking.id,
      message: `Payment successful! Transaction ID: ${transactionId}. Your booking is confirmed.`,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: 'Payment processed successfully',
      payment: {
        id: payment.id,
        bookingId: payment.booking_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.payment_status,
        transactionId: payment.transaction_id,
        paymentDate: payment.payment_date
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  } finally {
    client.release();
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment: result.rows[0] });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Get payment by booking ID
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    const result = await pool.query(
      'SELECT * FROM payments WHERE booking_id = $1',
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found for this booking' });
    }

    res.json({ payment: result.rows[0] });
  } catch (error) {
    console.error('Get payment by booking error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Refund payment
router.post('/:id/refund', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    if (payment.payment_status !== 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only completed payments can be refunded' });
    }

    // Simulate refund processing
    const refundTransactionId = `RFN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await client.query(
      `UPDATE payments 
       SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');

    // Publish refund event
    await publishEvent('payment-refunded', {
      id: payment.id,
      bookingId: payment.booking_id,
      amount: payment.amount,
      refundTransactionId,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Payment refunded successfully',
      refundTransactionId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refund payment error:', error);
    res.status(500).json({ error: 'Failed to refund payment' });
  } finally {
    client.release();
  }
});

module.exports = router;
