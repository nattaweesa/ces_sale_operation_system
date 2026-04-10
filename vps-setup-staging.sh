#!/bin/bash

# VPS Staging Environment Setup Script
# Run this ONCE on VPS to create the staging folder structure
# Usage: ssh root@187.77.156.215 < vps-setup-staging.sh

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  VPS Staging Environment Setup"
echo "║  This will create /root/ces_sale_operation_system_staging"
echo "╚══════════════════════════════════════════════════════════════╝"

VPS_PROD_PATH="/root/ces_sale_operation_system"
VPS_STAGING_PATH="/root/ces_sale_operation_system_staging"

# Check if production exists
if [ ! -d "$VPS_PROD_PATH" ]; then
    echo "❌ Error: Production path '$VPS_PROD_PATH' not found"
    echo "   Please ensure production is set up first"
    exit 1
fi

echo ""
echo "✅ Production path found: $VPS_PROD_PATH"

# Create staging folder
if [ -d "$VPS_STAGING_PATH" ]; then
    echo "📁 Staging path already exists: $VPS_STAGING_PATH"
    read -p "   Delete and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   🗑️  Removing old staging folder..."
        rm -rf "$VPS_STAGING_PATH"
    else
        echo "✅ Using existing staging folder"
        exit 0
    fi
fi

echo ""
echo "🔨 Creating staging environment..."

# Create directories
mkdir -p "$VPS_STAGING_PATH"
cd "$VPS_STAGING_PATH"

# Initialize git (fresh repo for staging)
echo "📥 Initializing git repository..."
git init
git config user.email "deploy@ces.local"
git config user.name "CES Deploy"
git remote add origin $(git -C "$VPS_PROD_PATH" remote get-url origin)
echo "   Remote: $(git remote get-url origin)"

# Fetch all branches
echo "📥 Fetching branches from origin..."
git fetch origin

# Checkout develop branch
echo "🌿 Checking out develop branch..."
git checkout develop

# Copy docker-compose files from production folder
echo "📋 Copying docker-compose files..."
cp "$VPS_PROD_PATH/docker-compose.staging.yml" .
cp "$VPS_PROD_PATH/docker-compose.prod.yml" .
cp "$VPS_PROD_PATH/.env.staging" .
cp "$VPS_PROD_PATH/.env.prod" .

# Create .env file for staging (used by docker-compose if no --env-file specified)
cp .env.staging .env

echo ""
echo "✅ Staging folder structure created:"
echo "   📁 $VPS_STAGING_PATH"
echo "   📄 docker-compose.staging.yml"
echo "   📄 .env.staging"

echo ""
echo "🚀 Starting staging services..."
echo "   This may take 1-2 minutes for first build..."

# Start services
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Wait a few seconds for services to start
sleep 5

echo ""
echo "✅ Staging services started!"

# Check status
docker compose -f docker-compose.staging.yml ps

echo ""
echo "✅ Staging environment setup complete!"
echo ""
echo "Access staging at:"
echo "   📱 Frontend: http://187.77.156.215:5174"
echo "   🔧 Backend: http://187.77.156.215:8001"
echo "   📊 Docs: http://187.77.156.215:8001/docs"
echo ""
echo "Compare with Production:"
echo "   📱 Frontend: http://187.77.156.215:5173"
echo "   🔧 Backend: http://187.77.156.215:8000"
echo ""
echo "Next steps:"
echo "   1. Make changes on Mac and push to 'develop' branch"
echo "   2. Run: ./deploy-staging.sh quick"
echo "   3. Test at http://187.77.156.215:5174"
echo "   4. Merge to 'main' when ready"
echo "   5. Run: ./deploy-production.sh quick"
