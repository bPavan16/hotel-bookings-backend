const { Kafka } = require('kafkajs');
const { 
  sendBookingConfirmation, 
  sendPaymentConfirmation, 
  sendBookingCancellation 
} = require('../services/email.service');

let kafka;
let consumer;

async function initKafka() {
  try {
    kafka = new Kafka({
      clientId: 'notification-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    consumer = kafka.consumer({ groupId: 'notification-service-group' });

    console.log('Connected to Kafka');
  } catch (error) {
    console.error('Kafka connection error:', error);
    throw error;
  }
}

async function handleNotificationRequest(notification) {
  console.log('Processing notification:', notification);
  
  try {
    const { type, userId, bookingId, message, email, ...data } = notification;

    // In a real application, you would fetch user email from user service or database
    const userEmail = email || 'user@example.com'; // Placeholder

    switch (type) {
      case 'booking-created':
        await sendBookingConfirmation({
          email: userEmail,
          bookingId,
          hotelName: data.hotelName,
          checkIn: data.checkInDate,
          checkOut: data.checkOutDate,
          totalPrice: data.totalPrice
        });
        break;

      case 'payment-success':
        await sendPaymentConfirmation({
          email: userEmail,
          bookingId,
          amount: data.amount,
          transactionId: data.transactionId
        });
        break;

      case 'booking-cancelled':
        await sendBookingCancellation({
          email: userEmail,
          bookingId
        });
        break;

      default:
        console.log(`Unknown notification type: ${type}`);
    }
  } catch (error) {
    console.error('Error handling notification:', error);
  }
}

async function startConsumer() {
  try {
    await consumer.connect();
    
    // Subscribe to multiple topics
    await consumer.subscribe({ 
      topics: ['notification-request', 'booking-created', 'payment-processed', 'booking-cancelled'], 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const notification = JSON.parse(message.value.toString());
          console.log(`Received message from ${topic}:`, notification);

          // Handle notification based on topic
          if (topic === 'notification-request') {
            await handleNotificationRequest(notification);
          } else if (topic === 'booking-created') {
            await handleNotificationRequest({
              type: 'booking-created',
              ...notification
            });
          } else if (topic === 'payment-processed') {
            await handleNotificationRequest({
              type: 'payment-success',
              ...notification
            });
          } else if (topic === 'booking-cancelled') {
            await handleNotificationRequest({
              type: 'booking-cancelled',
              ...notification
            });
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    });

    console.log('Kafka consumer started, listening for notifications');
  } catch (error) {
    console.error('Error starting consumer:', error);
    throw error;
  }
}

async function disconnectKafka() {
  if (consumer) {
    await consumer.disconnect();
  }
}

module.exports = {
  initKafka,
  startConsumer,
  disconnectKafka
};
