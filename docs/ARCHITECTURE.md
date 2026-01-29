# Hotel Booking Backend - Architecture Documentation

## System Overview

This is a production-ready hotel booking backend built with microservices architecture. The system is designed to be scalable, maintainable, and follows industry best practices.

## Technology Stack

### Backend Services
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework for all services
- **PostgreSQL** - Primary relational database
- **Redis** - Caching and session storage
- **Apache Kafka** - Event streaming and inter-service communication
- **Docker & Docker Compose** - Containerization and orchestration

### Libraries & Tools
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **joi** - Request validation
- **kafkajs** - Kafka client for Node.js
- **nodemailer** - Email notifications
- **pg** - PostgreSQL client
- **redis** - Redis client
- **helmet** - Security headers
- **cors** - CORS middleware
- **morgan** - HTTP request logger

## Microservices Architecture

### 1. API Gateway (Port 3000)
**Purpose**: Single entry point for all client requests

**Features**:
- Request routing to appropriate services
- Rate limiting
- Request/response logging
- Error handling

**Routes**:
- `/api/auth/*` → User Service
- `/api/users/*` → User Service
- `/api/hotels/*` → Hotel Service
- `/api/bookings/*` → Booking Service
- `/api/payments/*` → Payment Service

### 2. User Service (Port 3001)
**Purpose**: User authentication and management

**Features**:
- User registration with password hashing
- JWT-based authentication
- User profile management
- Session caching in Redis

**Database Tables**:
- `users`

**Key Endpoints**:
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /users/profile` - Get user profile (protected)
- `PUT /users/profile` - Update user profile (protected)

### 3. Hotel Service (Port 3002)
**Purpose**: Hotel and room management

**Features**:
- Hotel CRUD operations
- Room management
- Search and filtering
- Redis caching for improved performance

**Database Tables**:
- `hotels`
- `rooms`

**Key Endpoints**:
- `GET /hotels` - List hotels with filters
- `GET /hotels/:id` - Get hotel details
- `POST /hotels` - Create hotel
- `GET /hotels/:id/rooms` - Get hotel rooms
- `POST /hotels/:id/rooms` - Create room

**Caching Strategy**:
- Hotel listings cached for 1 hour
- Room availability cached with TTL
- Cache invalidation on updates

### 4. Booking Service (Port 3003)
**Purpose**: Reservation management

**Features**:
- Booking creation with conflict checking
- Booking status management
- Kafka event publishing
- Transaction handling for data consistency

**Database Tables**:
- `bookings`

**Key Endpoints**:
- `POST /bookings` - Create booking
- `GET /bookings` - Get user bookings
- `GET /bookings/:id` - Get booking details
- `PUT /bookings/:id/status` - Update booking status
- `PUT /bookings/:id/cancel` - Cancel booking

**Kafka Events Published**:
- `booking-created`
- `booking-status-updated`
- `booking-cancelled`

### 5. Payment Service (Port 3004)
**Purpose**: Payment processing

**Features**:
- Payment processing (simulated)
- Kafka consumer for booking events
- Payment record management
- Refund processing

**Database Tables**:
- `payments`

**Key Endpoints**:
- `POST /payments` - Process payment
- `GET /payments/:id` - Get payment details
- `GET /payments/booking/:bookingId` - Get payment by booking
- `POST /payments/:id/refund` - Refund payment

**Kafka Topics**:
- **Consumes**: `booking-created`
- **Publishes**: `payment-processed`, `payment-refunded`, `notification-request`

### 6. Notification Service (Port 3005)
**Purpose**: Email and SMS notifications

**Features**:
- Kafka consumer for notification events
- Email sending via SMTP
- Multiple notification templates

**Kafka Topics Consumed**:
- `notification-request`
- `booking-created`
- `payment-processed`
- `booking-cancelled`

**Notification Types**:
- Booking confirmation
- Payment confirmation
- Booking cancellation
- Custom notifications

## Infrastructure Components

### PostgreSQL (Port 5432)
**Purpose**: Primary database for all services

**Database Schema**:
```sql
- users (authentication and user data)
- hotels (hotel information)
- rooms (room inventory)
- bookings (reservations)
- payments (payment records)
- reviews (customer reviews)
```

**Features**:
- ACID compliance
- Foreign key constraints
- Indexes for performance
- Connection pooling

### Redis (Port 6379)
**Purpose**: Caching and session storage

**Use Cases**:
- User session caching
- Hotel and room data caching
- Booking list caching
- Rate limiting data

**Cache Strategy**:
- TTL-based expiration
- Cache invalidation on updates
- Read-through caching pattern

### Kafka + Zookeeper (Ports 9092, 2181)
**Purpose**: Event streaming and asynchronous communication

**Topics**:
1. `booking-created` - New booking events
2. `booking-status-updated` - Booking status changes
3. `booking-cancelled` - Booking cancellations
4. `payment-processed` - Payment completions
5. `payment-refunded` - Payment refunds
6. `notification-request` - Notification triggers

**Consumer Groups**:
- `payment-service-group`
- `notification-service-group`

## Data Flow Examples

### 1. Complete Booking Flow
```
1. Client → API Gateway → Booking Service
2. Booking Service creates booking in DB
3. Booking Service publishes to Kafka: booking-created
4. Payment Service consumes event, creates payment record
5. Payment Service publishes: notification-request
6. Notification Service sends confirmation email
```

### 2. Payment Processing Flow
```
1. Client → API Gateway → Payment Service
2. Payment Service validates booking
3. Payment Service processes payment (simulated)
4. Payment Service updates booking status to "confirmed"
5. Payment Service publishes: payment-processed
6. Notification Service sends payment confirmation
```

### 3. Booking Cancellation Flow
```
1. Client → API Gateway → Booking Service
2. Booking Service updates status to "cancelled"
3. Booking Service publishes: booking-cancelled
4. Notification Service sends cancellation email
```

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Token expiration (7 days)
- Secure password hashing with bcrypt
- Protected routes with middleware

### API Security
- Helmet.js for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Input validation with Joi

### Database Security
- Parameterized queries (SQL injection prevention)
- Connection pooling with timeouts
- Environment-based credentials

## Performance Optimizations

### Caching
- Redis caching for frequently accessed data
- Cache-aside pattern
- TTL-based expiration

### Database
- Indexes on frequently queried columns
- Connection pooling
- Query optimization

### Async Processing
- Kafka for asynchronous tasks
- Non-blocking operations
- Background processing for notifications

## Monitoring & Observability

### Logging
- Morgan for HTTP request logging
- Console logging for application events
- Kafka message logging

### Health Checks
- `/health` endpoint on all services
- Database connection validation
- Service status reporting

## Scalability Considerations

### Horizontal Scaling
- Stateless services (except for in-memory caches)
- Load balancer support
- Kafka consumer groups for parallel processing

### Vertical Scaling
- Connection pool configuration
- Resource limits in Docker

### Database Scaling
- Read replicas (future enhancement)
- Database sharding (future enhancement)
- Query optimization

## Development Workflow

### Local Development
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Rebuild specific service
docker-compose up -d --build [service-name]

# Stop all services
docker-compose down
```

### Testing
```bash
# Use Postman collection
# Import postman-collection.json

# Or use cURL commands
# See QUICKSTART.md
```

## Deployment Considerations

### Production Readiness Checklist
- [ ] Update all default passwords
- [ ] Configure proper JWT secret
- [ ] Set up SSL/TLS certificates
- [ ] Configure proper SMTP settings
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up database backups
- [ ] Configure Kafka replication
- [ ] Set up CI/CD pipeline
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation review

### Environment Variables
All services use environment variables for configuration. See `.env` file for required variables.

### Docker Compose Production
For production, consider:
- Using `docker-compose.prod.yml`
- Separate networks for services
- Volume management for persistence
- Resource limits
- Health checks
- Restart policies

## Future Enhancements

### Phase 1
- [ ] Comprehensive unit tests
- [ ] Integration tests
- [ ] API documentation with Swagger
- [ ] Admin dashboard

### Phase 2
- [ ] Payment gateway integration (Stripe, PayPal)
- [ ] SMS notifications
- [ ] Advanced search with Elasticsearch
- [ ] Review and rating system

### Phase 3
- [ ] Kubernetes deployment
- [ ] Service mesh (Istio)
- [ ] Distributed tracing (Jaeger)
- [ ] Advanced monitoring (Prometheus, Grafana)

### Phase 4
- [ ] Mobile app support
- [ ] Real-time updates with WebSocket
- [ ] Multi-language support
- [ ] Advanced analytics

## Troubleshooting

### Common Issues

**Services not starting**:
- Check Docker is running
- Check port availability
- Review logs: `docker-compose logs`

**Database connection errors**:
- Wait for PostgreSQL to be fully initialized
- Check connection credentials
- Verify network connectivity

**Kafka connection errors**:
- Kafka takes time to start (30-60 seconds)
- Check Zookeeper is running
- Verify broker configuration

**Cache issues**:
- Clear Redis cache: `docker exec -it hotel-redis redis-cli FLUSHALL`
- Check Redis connection

## Contact & Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review QUICKSTART.md
3. Check service health endpoints
4. Review architecture documentation

## License

MIT License - See LICENSE file for details
