const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const bookingRoutes = require('./routes/booking.routes');
const { connectDatabase, testConnection } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initKafka } = require('./config/kafka');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await testConnection();
    res.json({ 
      status: 'healthy', 
      service: 'booking-service',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'booking-service',
      error: error.message 
    });
  }
});

// Routes
app.use('/bookings', bookingRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize connections and start server
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await initKafka();
    
    app.listen(PORT, () => {
      console.log(`Booking Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
