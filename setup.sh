#!/bin/bash

echo "Hotel Booking System - Complete Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}Docker is running${NC}"
echo ""

# Backend setup
echo "Setting up Backend Services..."
echo "--------------------------------"
cd "$(dirname "$0")"

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down

# Build and start backend services
echo "Building and starting backend services..."
docker-compose up -d --build

echo ""
echo "Waiting for services to initialize (30 seconds)..."
sleep 30

# Check backend health
echo ""
echo "Checking backend services..."
BACKEND_HEALTH=$(curl -s http://localhost:3000/health 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Backend services are healthy${NC}"
else
    echo -e "${YELLOW}WARNING: Backend services are still starting up...${NC}"
fi

# Frontend setup
echo ""
echo "Setting up Frontend..."
echo "------------------------"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "Frontend dependencies already installed"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi

echo ""
echo -e "${GREEN}Setup Complete!${NC}"
echo ""
echo "=================================================="
echo "To start the application:"
echo "=================================================="
echo ""
echo "1. Backend is already running at:"
echo "   - API Gateway:    http://localhost:3000"
echo "   - PostgreSQL:     localhost:5432"
echo "   - Redis:          localhost:6379"
echo "   - Kafka:          localhost:9092"
echo ""
echo "2. Start the frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "   Frontend will be at: http://localhost:5173"
echo ""
echo "=================================================="
echo "View backend logs:"
echo "   docker-compose logs -f"
echo ""
echo "Stop all services:"
echo "   docker-compose down"
echo "=================================================="
echo ""
