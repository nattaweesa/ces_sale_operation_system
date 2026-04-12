#!/bin/bash

# Deploy to VPS Production
# Usage: ./deploy-production.sh [build|quick]
#   build  - Full rebuild with docker build (slower, for dependency changes)
#   quick  - Only restart containers (faster, for code-only changes)

set -euo pipefail

ENVIRONMENT="${1:-quick}"
VPS_USER="${VPS_USER:-cesdeploy}"
VPS_HOST="${VPS_HOST:-187.77.156.215}"
VPS_PATH="${VPS_PATH:-/srv/ces_sale_operation_system}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
DB_NAME="ces_sale_operation"
MIN_AXIOS_VERSION="${MIN_AXIOS_VERSION:-1.15.0}"

version_ge() {
    local v1="$1"
    local v2="$2"
    [[ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" == "$v2" ]]
}

if [[ "$ENVIRONMENT" != "build" && "$ENVIRONMENT" != "quick" ]]; then
    echo "❌ Invalid mode: '$ENVIRONMENT'"
    echo "Usage: ./deploy-production.sh [build|quick]"
    exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deploying to Production (VPS) - $ENVIRONMENT Deploy"
echo "╚══════════════════════════════════════════════════════════════╝"

# Verify git is clean
if [[ $(git status --porcelain) ]]; then
    echo "❌ Error: Uncommitted changes detected. Please commit or stash changes first."
    git status
    exit 1
fi

echo "📦 Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "📋 Latest commit: $(git log -1 --oneline)"

# Verify on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "❌ Refusing production deploy from branch '$CURRENT_BRANCH'. Switch to 'main' first."
    exit 1
fi

LOCAL_AXIOS_VERSION="$(awk '/node_modules\/axios/{flag=1;next} flag&&/"version"/{gsub(/[", ]/,"",$2);print $2;flag=0}' frontend/package-lock.json)"
if [[ -z "$LOCAL_AXIOS_VERSION" ]]; then
    echo "❌ Unable to read axios version from frontend/package-lock.json"
    exit 1
fi
if ! version_ge "$LOCAL_AXIOS_VERSION" "$MIN_AXIOS_VERSION"; then
    echo "❌ Refusing deploy: axios lockfile version '$LOCAL_AXIOS_VERSION' is lower than required '$MIN_AXIOS_VERSION'"
    exit 1
fi

# Push to remote
echo ""
echo "🔄 Pushing to origin..."
git push origin main

echo ""
echo "💾 Creating pre-deploy production backup..."
./backup-production.sh

# SSH into VPS and deploy
echo ""
echo "🚀 Deploying to VPS..."

if [[ "$ENVIRONMENT" == "build" ]]; then
    echo "   🔨 Full rebuild (this may take 2-5 minutes)..."
    ssh "$VPS_USER@$VPS_HOST" << EOF
        set -e
        cd "$VPS_PATH"
        COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
        if ! git diff --quiet || ! git diff --cached --quiet; then
            echo "   ❌ Refusing deploy on VPS: tracked changes present in $VPS_PATH"
            git status --short
            exit 1
        fi
        echo "   📥 Pulling latest main..."
        git fetch origin && git checkout main && git pull --ff-only
        REMOTE_AXIOS_VERSION=\$(awk '/node_modules\/axios/{flag=1;next} flag&&/"version"/{gsub(/[", ]/,"",\$2);print \$2;flag=0}' frontend/package-lock.json)
        if [[ -z "\$REMOTE_AXIOS_VERSION" ]]; then
            echo "   ❌ Unable to read axios version on VPS"
            exit 1
        fi
        if [[ "\$(printf '%s\\n' "$MIN_AXIOS_VERSION" "\$REMOTE_AXIOS_VERSION" | sort -V | head -n1)" != "$MIN_AXIOS_VERSION" ]]; then
            echo "   ❌ Refusing deploy on VPS: axios lockfile version '\$REMOTE_AXIOS_VERSION' is lower than required '$MIN_AXIOS_VERSION'"
            exit 1
        fi
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
        docker exec "\$BACKEND_CONTAINER" alembic upgrade heads
        echo "   🩺 Verifying health..."
        curl -fsS http://localhost:8000/health >/dev/null
        echo "   ✅ Production deployment complete"
EOF
else
    echo "   ⚡ Quick restart (code-only changes)..."
    ssh "$VPS_USER@$VPS_HOST" << EOF
        set -e
        cd "$VPS_PATH"
        COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
        if ! git diff --quiet || ! git diff --cached --quiet; then
            echo "   ❌ Refusing deploy on VPS: tracked changes present in $VPS_PATH"
            git status --short
            exit 1
        fi
        echo "   📥 Pulling latest main..."
        git fetch origin && git checkout main && git pull --ff-only
        REMOTE_AXIOS_VERSION=\$(awk '/node_modules\/axios/{flag=1;next} flag&&/"version"/{gsub(/[", ]/,"",\$2);print \$2;flag=0}' frontend/package-lock.json)
        if [[ -z "\$REMOTE_AXIOS_VERSION" ]]; then
            echo "   ❌ Unable to read axios version on VPS"
            exit 1
        fi
        if [[ "\$(printf '%s\\n' "$MIN_AXIOS_VERSION" "\$REMOTE_AXIOS_VERSION" | sort -V | head -n1)" != "$MIN_AXIOS_VERSION" ]]; then
            echo "   ❌ Refusing deploy on VPS: axios lockfile version '\$REMOTE_AXIOS_VERSION' is lower than required '$MIN_AXIOS_VERSION'"
            exit 1
        fi
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
        docker exec "\$BACKEND_CONTAINER" alembic upgrade heads
        echo "   🩺 Verifying health..."
        curl -fsS http://localhost:8000/health >/dev/null
        echo "   ✅ Production deployment complete"
EOF
fi

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
    BUILD_STATUS=$(ssh "$VPS_USER@$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps --services --filter 'status=running' 2>/dev/null | wc -l")

if [[ $BUILD_STATUS -ge 3 ]]; then
    echo "✅ All services running!"
    echo ""
    echo "🎉 Production deployment successful!"
    echo ""
    echo "Access your application:"
    echo "  📱 Frontend: http://187.77.156.215:5173"
    echo "  🔧 Backend API: http://187.77.156.215:8000"
    echo "  📊 API Docs: http://187.77.156.215:8000/docs"
else
    echo "⚠️  Warning: Some services may not be running. Check logs:"
    echo "  ssh $VPS_USER@$VPS_HOST"
    echo "  cd $VPS_PATH"
    echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
    echo ""
    echo "Rollback if needed:"
    echo "  ./rollback-production.sh latest"
    exit 1
fi
