#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Deployment Setup..."

# 1. Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo "✅ Docker installed."
else
    echo "✅ Docker is already installed."
fi

# 2. Check if Docker Compose is installed (Plugin)
if ! docker compose version &> /dev/null; then
    echo "⚠️ Docker Compose plugin not found. Attempting to install..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed."
fi

# 3. Create .env file if not exists
if [ ! -f .env ]; then
    echo "🔑 Creating .env file..."
    read -p "Enter your Google Gemini API Key: " GEMINI_KEY
    echo "GEMINI_API_KEY=$GEMINI_KEY" > .env
    echo "✅ .env created."
fi

# 4. Build and Start
echo "🏗️  Building and Starting Containers..."
docker compose up -d --build

# 5. Run Migrations
echo "🔄 Running Database Migrations..."
# Wait for DB to be ready
sleep 10
docker compose exec app node migrate.js

echo "🎉 Deployment Complete! App running on port 3000."
