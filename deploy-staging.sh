#!/bin/bash

# Deploy to VPS Staging
# Usage: ./deploy-staging.sh [build|quick]
#   build  - Full rebuild with docker build (slower, for dependency changes)
#   quick  - Only restart containers (faster, for code-only changes)

set -euo pipefail

ENVIRONMENT="${1:-quick}"
VPS_USER="root"
VPS_HOST="187.77.156.215"
VPS_PATH="/root/ces_sale_operation_system_staging"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"
DB_NAME="ces_sale_operation_staging"

if [[ "$ENVIRONMENT" != "build" && "$ENVIRONMENT" != "quick" ]]; then
    echo "❌ Invalid mode: '$ENVIRONMENT'"
    echo "Usage: ./deploy-staging.sh [build|quick]"
    exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deploying to Staging (VPS) - $ENVIRONMENT Deploy"
echo "╚══════════════════════════════════════════════════════════════╝"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "❌ Error: Uncommitted changes detected. Commit or stash them before staging deploy."
    git status --short
    exit 1
fi

echo "📦 Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "📋 Latest commit: $(git log -1 --oneline)"

# Push develop branch to remote
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo ""
echo "🔄 Pushing branch '$CURRENT_BRANCH' to origin..."
git push origin "$CURRENT_BRANCH"

# SSH into VPS and deploy
echo ""
echo "🚀 Deploying to Staging VPS..."

if [[ "$ENVIRONMENT" == "build" ]]; then
    echo "   🔨 Full rebuild (this may take 2-5 minutes)..."
    ssh "$VPS_USER@$VPS_HOST" << EOF
        set -e
        cd "$VPS_PATH"
        COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
        echo "   📥 Pulling latest $CURRENT_BRANCH..."
        git fetch origin && git checkout $CURRENT_BRANCH && git pull --ff-only
        echo "   🔨 Building images..."
        \$COMPOSE build
        echo "   🚀 Starting services..."
        \$COMPOSE up -d
        BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
        DB_CONTAINER=\$(\$COMPOSE ps -q db)
        HAS_ALEMBIC=\$(docker exec "\$DB_CONTAINER" psql -U ces -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version');")
        TABLE_COUNT=\$(docker exec "\$DB_CONTAINER" psql -U ces -d $DB_NAME -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
        if [[ "\$HAS_ALEMBIC" != "t" && "\$TABLE_COUNT" -gt 0 ]]; then
            echo "   🏷️  Bootstrapping Alembic version table for existing database..."
            docker exec "\$BACKEND_CONTAINER" alembic stamp head
        fi
        echo "   🗃️  Running database migrations..."
        docker exec "\$BACKEND_CONTAINER" alembic upgrade head
        echo "   ✅ Staging deployment complete"
EOF
else
    echo "   ⚡ Quick restart (code-only changes)..."
    ssh "$VPS_USER@$VPS_HOST" << EOF
        set -e
        cd "$VPS_PATH"
        COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
        echo "   📥 Pulling latest $CURRENT_BRANCH..."
        git fetch origin && git checkout $CURRENT_BRANCH && git pull --ff-only
        echo "   🔄 Restarting services..."
        \$COMPOSE up -d
        BACKEND_CONTAINER=\$(\$COMPOSE ps -q backend)
        DB_CONTAINER=\$(\$COMPOSE ps -q db)
        HAS_ALEMBIC=\$(docker exec "\$DB_CONTAINER" psql -U ces -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alembic_version');")
        TABLE_COUNT=\$(docker exec "\$DB_CONTAINER" psql -U ces -d $DB_NAME -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
        if [[ "\$HAS_ALEMBIC" != "t" && "\$TABLE_COUNT" -gt 0 ]]; then
            echo "   🏷️  Bootstrapping Alembic version table for existing database..."
            docker exec "\$BACKEND_CONTAINER" alembic stamp head
        fi
        echo "   🗃️  Running database migrations..."
        docker exec "\$BACKEND_CONTAINER" alembic upgrade head
        echo "   ✅ Staging deployment complete"
EOF
fi

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
BUILD_STATUS=$(ssh "$VPS_USER@$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps --services --filter 'status=running' 2>/dev/null | wc -l")

if [[ $BUILD_STATUS -ge 3 ]]; then
    echo "✅ All services running!"
    echo ""
    echo "🎉 Staging deployment successful!"
    echo ""
    echo "Access your application:"
    echo "  📱 Frontend: http://187.77.156.215:5174 (Staging)"
    echo "  🔧 Backend API: http://187.77.156.215:8001 (Staging)"
    echo "  📊 API Docs: http://187.77.156.215:8001/docs (Staging)"
    echo ""
    echo "Compare with Production:"
    echo "  📱 Frontend: http://187.77.156.215:5173 (Production)"
    echo "  🔧 Backend API: http://187.77.156.215:8000 (Production)"
else
    echo "⚠️  Warning: Some services may not be running. Check logs:"
    echo "  ssh root@187.77.156.215"
    echo "  cd $VPS_PATH"
    echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
    exit 1
fi
