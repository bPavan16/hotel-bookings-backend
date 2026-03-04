import express from 'express';
import Joi from 'joi';
import { sendEmail } from '../services/email.service.js';

const router = express.Router();

const emailSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().required(),
  message: Joi.string().required(),
  html: Joi.string().optional()
});

// Send custom notification (for testing or admin use)
router.post('/send', async (req, res) => {
  try {
    const { error, value } = emailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { to, subject, message, html } = value;

    const result = await sendEmail({
      to,
      subject,
      text: message,
      html: html || message
    });

    if (result.success) {
      res.json({
        message: 'Notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        error: 'Failed to send notification',
        details: result.error
      });
    }
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
