#!/bin/bash

# Dexter Unified Dev Server Startup Script

# 1. Ensure Docker is running (Neo4j, Redis, Postgres)
echo "🚀 Starting Docker containers (Neo4j, Redis, Postgres)..."
docker-compose up -d

# 2. Check if the containers are healthy
echo "⏳ Waiting for containers to initialize..."
for i in {1..30}; do
  if nc -z localhost 7687 && nc -z localhost 5440 && nc -z localhost 6389; then
    echo "✅ Containers are ready!"
    break
  fi
  sleep 2
done

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $(jobs -p)
    exit
}

trap cleanup EXIT

# 3. Start Graph RAG (Python AI Worker)
echo "🤖 Starting Graph RAG AI worker (Port 8000)..."
cd graph_rag
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
cd ..

# 4. Start Backend (Express API)
echo "📡 Starting Backend API (Port 5001)..."
cd backend
npm run dev &
cd ..

# 5. Start Frontend (Vite)
echo "💻 Starting Frontend (Port 3000)..."
cd web
npm run dev &
cd ..

echo "✅ All services are starting up! Press Ctrl+C to stop everything."

# Keep script running
wait
