import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  
});

app.use("/api/", limiter);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
  });
});

// Service URLs
const services = {
  user: process.env.USER_SERVICE_URL || "http://localhost:3001",
  hotel: process.env.HOTEL_SERVICE_URL || "http://localhost:3002",
  booking: process.env.BOOKING_SERVICE_URL || "http://localhost:3003",
  payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:3004",
};

// Proxy configuration options
const proxyOptions = {
  changeOrigin: true,
  logLevel: "debug",
  onError: (err, req, res) => {
    console.error("Proxy Error:", err);
    res.status(500).json({
      error: "Service temporarily unavailable",
      message: err.message,
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
  },
};

// User Service routes
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: services.user,
    pathRewrite: { "^/api/auth": "/auth" },
    ...proxyOptions,
  }),
);

app.use(
  "/api/users",
  createProxyMiddleware({
    target: services.user,
    pathRewrite: { "^/api/users": "/users" },
    ...proxyOptions,
  }),
);

// Hotel Service routes
app.use(
  "/api/hotels",
  createProxyMiddleware({
    target: services.hotel,
    pathRewrite: { "^/api/hotels": "/hotels" },
    ...proxyOptions,
  }),
);

// Booking Service routes
app.use(
  "/api/bookings",
  createProxyMiddleware({
    target: services.booking,
    pathRewrite: { "^/api/bookings": "/bookings" },
    ...proxyOptions,
  }),
);

// Payment Service routes
app.use(
  "/api/payments",
  createProxyMiddleware({
    target: services.payment,
    pathRewrite: { "^/api/payments": "/payments" },
    ...proxyOptions,
  }),
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start the server and display the service configuration
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log("Service Configuration:");
  console.log(`  User Service: ${services.user}`);
  console.log(`  Hotel Service: ${services.hotel}`);
  console.log(`  Booking Service: ${services.booking}`);
  console.log(`  Payment Service: ${services.payment}`);
});
