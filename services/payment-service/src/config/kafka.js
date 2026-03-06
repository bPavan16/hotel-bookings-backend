import { Kafka } from "kafkajs";
import { Payment } from "./database.js";

let kafka;
let producer;
let consumer;

async function initKafka() {
  try {
    kafka = new Kafka({
      clientId: "payment-service",
      brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: "payment-service-group" });

    await producer.connect();
    console.log("Connected to Kafka");
  } catch (error) {
    console.error("Kafka connection error:", error);
    throw error;
  }
}

async function publishEvent(topic, message) {
  try {
    if (!producer) {
      throw new Error("Kafka producer not initialized");
    }

    await producer.send({
      topic,
      messages: [
        {
          key: message.id?.toString() || Date.now().toString(),
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    });

    console.log(`Published event to ${topic}:`, message);
  } catch (error) {
    console.error(`Error publishing to ${topic}:`, error);
    throw error;
  }
}

async function handleBookingCreated(booking) {
  console.log("Processing booking created event:", booking);

  try {
    // Check if payment already exists for this booking
    const existingPayment = await Payment.findOne({
      where: { booking_id: booking.id },
    });

    if (existingPayment) {
      console.log(`Payment already exists for booking ${booking.id}`);
      return;
    }

    // Create a pending payment record
    const payment = await Payment.create({
      booking_id: booking.id,
      amount: booking.totalPrice,
      payment_method: "pending",
      payment_status: "pending",
    });

    console.log("Payment record created:", payment.toJSON());

    // Publish notification event
    await publishEvent("notification-request", {
      type: "booking-created",
      userId: booking.userId,
      bookingId: booking.id,
      message: `Your booking has been created. Total amount: $${booking.totalPrice}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error handling booking created:", error);
  }
}

async function startConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({
      topic: "booking-created",
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const booking = JSON.parse(message.value.toString());
          console.log(`Received message from ${topic}:`, booking);

          if (topic === "booking-created") {
            await handleBookingCreated(booking);
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      },
    });

    console.log("Kafka consumer started");
  } catch (error) {
    console.error("Error starting consumer:", error);
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

export { initKafka, publishEvent, startConsumer, disconnectKafka };
