# Hotel Booking System - Full Stack Application

A complete hotel booking system with microservices backend and modern React frontend.

## 🏗️ Architecture

### Backend (Microservices)

- **API Gateway** (Port 3000) - Single entry point for all client requests
- **User Service** (Port 3001) - User authentication and management
- **Hotel Service** (Port 3002) - Hotel and room management
- **Booking Service** (Port 3003) - Reservation handling
- **Payment Service** (Port 3004) - Payment processing
- **Notification Service** (Port 3005) - Email/SMS notifications

### Frontend

- **React App** (Port 5173) - Modern SPA with Vite, Tailwind CSS

### Infrastructure

- **PostgreSQL** (Port 5432) - Primary database
- **Redis** (Port 6379) - Caching layer
- **Kafka + Zookeeper** (Ports 9092, 2181) - Event streaming

## ✨ Features

- 🔐 User authentication with JWT
- 🏨 Hotel browsing and search
- 🛏️ Room selection and booking
- 💳 Payment processing
- 📧 Email notifications
- 👤 User profile management
- 📱 Responsive design
- 🚀 Microservices architecture
- 📊 Real-time event streaming with Kafka
- ⚡ Redis caching for performance

## 🚀 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- npm or yarn

## ⚡ Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
chmod +x setup.sh
./setup.sh

# Start frontend
cd frontend
npm run dev
```

### Option 2: Manual Setup

**1. Start Backend Services**

```bash
# Configure environment
cp .env.example .env

# Start all backend services
docker-compose up -d

# Check service health
docker-compose ps
```

**2. Start Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 🌐 Access the Application

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000
- **API Documentation**: See [QUICKSTART.md](QUICKSTART.md)

## 📖 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get started quickly with API testing
- **[Architecture Documentation](ARCHITECTURE.md)** - Detailed system architecture
- **[Frontend README](frontend/README.md)** - Frontend setup and features
- **[Postman Collection](postman-collection.json)** - API testing collection

## 🎯 User Flow

1. **Register/Login** → Create account or sign in
2. **Browse Hotels** → Search and filter hotels by location
3. **Select Room** → View hotel details and available rooms
4. **Book Room** → Choose dates and complete booking
5. **Make Payment** → Process payment (simulated)
6. **Manage Bookings** → View and manage your reservations

## 📸 Screenshots

### Home Page

Modern landing page with hero section and features

### Hotel Listing

Browse hotels with search and filter options

### Booking Flow

Seamless booking experience with date selection and payment

### User Dashboard

Manage bookings and profile in one place

## 🛠️ Development

### Backend Development

Run individual services locally:

```bash
# Example: User Service
cd services/user-service
npm install
npm run dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will proxy API requests to `http://localhost:3000`

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f user-service

# Frontend (in separate terminal)
cd frontend && npm run dev
```

## 🔧 Technology Stack

### Backend

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Message Broker**: Apache Kafka 7.5
- **Authentication**: JWT (jsonwebtoken)
- \*📁 Project Structure

```
adv-backend/
├-- services/                    # Backend microservices
│   ├-- api-gateway/            # API Gateway service
│   ├-- user-service/           # User & Auth service
│   ├-- hotel-service/          # Hotel management
│   ├-- booking-service/        # Booking management
│   ├-- payment-service/        # Payment processing
│   └-- notification-service/   # Email notifications
├-- frontend/                    # React frontend
│   ├-- src/
│   │   ├-- components/         # Reusable components
│   │   ├-- pages/              # Page components
│   │   ├-- context/            # Context providers
│   │   └-- services/           # API services
│   ├-- public/
│   └-- package.json
├-- docker-compose.yml          # Docker services config
├-- init-db.sql                 # Database initialization
├-- setup.sh                    # Automated setup script
├-- start.sh                    # Backend startup script
├-- .env                        # Environment variables
├-- QUICKSTART.md              # Quick start guide
├-- ARCHITECTURE.md            # Architecture docs
└-- README.md                  # This file
```

adv-backend/
├-- services/
│ ├-- api-gateway/
│ ├-- user-service/
│ ├-- hotel-service/
│ ├-- booking-service/
│ ├-- payment-service/
│ └-- notification-service/
├-- docker-compose.yml
├-- init-db.sql
├-- .env
└-- README.md

````

## Service Communication

- **Synchronous**: REST APIs via API Gateway
- **Asynchronous**: Kafka events for booking confirmations, payments, and notifications

## Kafka Topics

- `booking-created` - Published when a new booking is created
- `payment-processed` - Published when payment is completed
- `booking-confirmed` - Published when booking is confirmed
- `notification-request` - Published to trigger notifications

## Testing

```bash
# Run tests for all services
docker-compose exec api-gateway npm test
docker-compose exec user-service npm test
# ... repeat for other services
````

## Monitoring

- View logs: `docker-compose logs -f [service-name]`
- PostgreSQL: Access via `localhost:5432`
- Redis: Access via `localhost:6379`
- Kafka: Access via `localhost:9092`

## Production Deployment

1. Update environment variables in `.env`
2. Use production-ready configurations
3. Set up proper logging and monitoring
4. Configure SSL/TLS certificates
5. Set up database backups
6. Configure Kafka replication

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License
