#!/bin/bash

echo "🏨 Starting Hotel Booking Microservices Backend..."
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove old volumes (optional - comment out if you want to keep data)
# echo "🗑️  Removing old volumes..."
# docker volume prune -f

# Build and start all services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose ps

echo ""
echo "✅ All services are starting up!"
echo ""
echo "🌐 Service URLs:"
echo "  API Gateway:         http://localhost:3000"
echo "  User Service:        http://localhost:3001"
echo "  Hotel Service:       http://localhost:3002"
echo "  Booking Service:     http://localhost:3003"
echo "  Payment Service:     http://localhost:3004"
echo "  Notification Service: http://localhost:3005"
echo ""
echo "🗄️  Infrastructure:"
echo "  PostgreSQL:          localhost:5432"
echo "  Redis:               localhost:6379"
echo "  Kafka:               localhost:9092"
echo "  Zookeeper:           localhost:2181"
echo ""
echo "📝 View logs with: docker-compose logs -f [service-name]"
echo "🛑 Stop all services: docker-compose down"
echo ""
