import express from "express";
import Joi from "joi";
import { sequelize, Booking, Payment } from "../config/database.js";
import { publishEvent } from "../config/kafka.js";

const router = express.Router();

const paymentSchema = Joi.object({
  bookingId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string()
    .valid("credit_card", "debit_card", "paypal", "stripe")
    .required(),
  cardNumber: Joi.string().optional(),
  cardHolderName: Joi.string().optional(),
  expiryDate: Joi.string().optional(),
  cvv: Joi.string().optional(),
});

// -- POST /  (process payment) -------------------------------------------------
router.post("/", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      await t.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const { bookingId, amount, paymentMethod } = value;

    const booking = await Booking.findByPk(bookingId, { transaction: t });
    if (!booking) {
      await t.rollback();
      return res.status(404).json({ error: "Booking not found" });
    }

    if (parseFloat(amount) !== parseFloat(booking.total_price)) {
      await t.rollback();
      return res
        .status(400)
        .json({ error: "Payment amount does not match booking total" });
    }

    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const paymentStatus = "completed";

    // Upsert payment record (ON CONFLICT equivalent via findOrCreate + update)
    const [payment] = await Payment.upsert(
      {
        booking_id: bookingId,
        amount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        transaction_id: transactionId,
        payment_date: new Date(),
      },
      { transaction: t, returning: true },
    );

    // Confirm booking
    await booking.update({ status: "confirmed" }, { transaction: t });

    await t.commit();

    // Publish events
    await publishEvent("payment-processed", {
      id: payment.id,
      bookingId: payment.booking_id,
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.payment_status,
      transactionId: payment.transaction_id,
      timestamp: new Date().toISOString(),
    });

    await publishEvent("notification-request", {
      type: "payment-success",
      userId: booking.user_id,
      bookingId: booking.id,
      message: `Payment successful! Transaction ID: ${transactionId}. Your booking is confirmed.`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: "Payment processed successfully",
      payment: {
        id: payment.id,
        bookingId: payment.booking_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.payment_status,
        transactionId: payment.transaction_id,
        paymentDate: payment.payment_date,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Process payment error:", error);
    res.status(500).json({ error: "Failed to process payment" });
  }
});

// -- GET /:id ------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json({ payment });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// -- GET /booking/:bookingId ---------------------------------------------------
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: { booking_id: req.params.bookingId },
    });
    if (!payment)
      return res
        .status(404)
        .json({ error: "Payment not found for this booking" });
    res.json({ payment });
  } catch (error) {
    console.error("Get payment by booking error:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// -- POST /:id/refund ----------------------------------------------------------
router.post("/:id/refund", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(req.params.id, { transaction: t });
    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.payment_status !== "completed") {
      await t.rollback();
      return res
        .status(400)
        .json({ error: "Only completed payments can be refunded" });
    }

    const refundTransactionId = `RFN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await payment.update({ payment_status: "refunded" }, { transaction: t });
    await t.commit();

    await publishEvent("payment-refunded", {
      id: payment.id,
      bookingId: payment.booking_id,
      amount: payment.amount,
      refundTransactionId,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: "Payment refunded successfully", refundTransactionId });
  } catch (error) {
    await t.rollback();
    console.error("Refund payment error:", error);
    res.status(500).json({ error: "Failed to refund payment" });
  }
});

export default router;
