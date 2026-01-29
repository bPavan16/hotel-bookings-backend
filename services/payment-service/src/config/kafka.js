const { Kafka } = require('kafkajs');
const { pool } = require('./database');

let kafka;
let producer;
let consumer;

async function initKafka() {
  try {
    kafka = new Kafka({
      clientId: 'payment-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'payment-service-group' });

    await producer.connect();
    console.log('Connected to Kafka');
  } catch (error) {
    console.error('Kafka connection error:', error);
    throw error;
  }
}

async function publishEvent(topic, message) {
  try {
    if (!producer) {
      throw new Error('Kafka producer not initialized');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: message.id?.toString() || Date.now().toString(),
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        }
      ]
    });

    console.log(`Published event to ${topic}:`, message);
  } catch (error) {
    console.error(`Error publishing to ${topic}:`, error);
    throw error;
  }
}

async function handleBookingCreated(booking) {
  console.log('Processing booking created event:', booking);
  
  try {
    // Check if payment already exists for this booking
    const existingPayment = await pool.query(
      'SELECT id FROM payments WHERE booking_id = $1',
      [booking.id]
    );

    if (existingPayment.rows.length > 0) {
      console.log(`Payment already exists for booking ${booking.id}`);
      return;
    }

    // Create a pending payment record
    const result = await pool.query(
      `INSERT INTO payments (booking_id, amount, payment_method, payment_status) 
       VALUES ($1, $2, 'pending', 'pending') 
       RETURNING *`,
      [booking.id, booking.totalPrice]
    );

    const payment = result.rows[0];
    console.log('Payment record created:', payment);

    // Publish notification event
    await publishEvent('notification-request', {
      type: 'booking-created',
      userId: booking.userId,
      bookingId: booking.id,
      message: `Your booking has been created. Total amount: $${booking.totalPrice}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling booking created:', error);
  }
}

async function startConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'booking-created', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const booking = JSON.parse(message.value.toString());
          console.log(`Received message from ${topic}:`, booking);

          if (topic === 'booking-created') {
            await handleBookingCreated(booking);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    });

    console.log('Kafka consumer started');
  } catch (error) {
    console.error('Error starting consumer:', error);
    throw error;
  }
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
  }
  if (consumer) {
    await consumer.disconnect();
  }
}

module.exports = {
  initKafka,
  publishEvent,
  startConsumer,
  disconnectKafka
};
