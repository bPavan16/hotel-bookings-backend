const { Kafka } = require('kafkajs');

let kafka;
let producer;

async function initKafka() {
  try {
    kafka = new Kafka({
      clientId: 'booking-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    producer = kafka.producer();
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

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
  }
}

module.exports = {
  initKafka,
  publishEvent,
  disconnectKafka
};
