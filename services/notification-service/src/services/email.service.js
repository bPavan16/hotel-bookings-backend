const nodemailer = require('nodemailer');

let transporter;

function initializeEmailService() {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  console.log('Email service initialized');
}

async function sendEmail({ to, subject, text, html }) {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    const info = await transporter.sendMail({
      from: `"Hotel Booking System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || text
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw error to prevent service crash
    return { success: false, error: error.message };
  }
}

async function sendBookingConfirmation({ email, bookingId, hotelName, checkIn, checkOut, totalPrice }) {
  const subject = 'Booking Confirmation';
  const html = `
    <h1>Booking Confirmation</h1>
    <p>Your booking has been confirmed!</p>
    <h2>Booking Details:</h2>
    <ul>
      <li><strong>Booking ID:</strong> ${bookingId}</li>
      <li><strong>Hotel:</strong> ${hotelName || 'N/A'}</li>
      <li><strong>Check-in:</strong> ${checkIn || 'N/A'}</li>
      <li><strong>Check-out:</strong> ${checkOut || 'N/A'}</li>
      <li><strong>Total Price:</strong> $${totalPrice || 'N/A'}</li>
    </ul>
    <p>Thank you for choosing our service!</p>
  `;

  return await sendEmail({ to: email, subject, html });
}

async function sendPaymentConfirmation({ email, bookingId, amount, transactionId }) {
  const subject = 'Payment Confirmation';
  const html = `
    <h1>Payment Successful</h1>
    <p>Your payment has been processed successfully!</p>
    <h2>Payment Details:</h2>
    <ul>
      <li><strong>Booking ID:</strong> ${bookingId}</li>
      <li><strong>Amount:</strong> $${amount}</li>
      <li><strong>Transaction ID:</strong> ${transactionId}</li>
    </ul>
    <p>Thank you for your payment!</p>
  `;

  return await sendEmail({ to: email, subject, html });
}

async function sendBookingCancellation({ email, bookingId }) {
  const subject = 'Booking Cancellation';
  const html = `
    <h1>Booking Cancelled</h1>
    <p>Your booking has been cancelled.</p>
    <h2>Details:</h2>
    <ul>
      <li><strong>Booking ID:</strong> ${bookingId}</li>
    </ul>
    <p>If you did not request this cancellation, please contact us immediately.</p>
  `;

  return await sendEmail({ to: email, subject, html });
}

module.exports = {
  initializeEmailService,
  sendEmail,
  sendBookingConfirmation,
  sendPaymentConfirmation,
  sendBookingCancellation
};
