# Deployment Guide - Production vs Staging

## Overview

This project uses three separate environments:
- **Local Development** (Mac): `docker-compose.yml` - for active development with hot-reload
- **Staging** (VPS): `docker-compose.staging.yml` - for testing before production
- **Production** (VPS): `docker-compose.prod.yml` - stable, optimized environment

## Local Development (Mac)

### Setup
```bash
cd /Users/Nattawee.S/ces_sale_operation
docker-compose up -d
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Database: localhost:5433

**Features:**
- Hot-reload for both backend (--reload) and frontend (Vite dev)
- Direct file mounting for rapid development
- Console output visible for debugging

**Shutdown:**
```bash
docker-compose down
```

## Staging Environment (VPS Port 5174)

### Initial Setup (One-time)
```bash
ssh root@187.77.156.215

cd /root/ces_sale_operation_system_staging

# Copy production files as base
cp -r /root/ces_sale_operation_system/{backend,frontend} .

# Create env file
cp /root/ces_sale_operation_system/.env.staging /root/ces_sale_operation_system_staging/

# Start staging
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

**Access:**
- Frontend: http://187.77.156.215:5174
- Backend: http://187.77.156.215:8001
- Database: 5434

**Features:**
- Development mode (--reload enabled)
- Separate database from production
- Test new features before production deployment
- Full file hot-reload support

**Workflow:**
1. Push changes to `develop` branch on GitHub
2. SSH into VPS and pull `develop` branch in staging folder
3. Rebuild containers: `docker compose -f docker-compose.staging.yml --env-file .env.staging build`
4. Run migrations automatically during deploy: `alembic upgrade head`
5. Test features at staging URLs
6. Once verified, merge `develop` → `main` and deploy to production

## Production Environment (VPS Port 5173)

### Current Setup
```bash
# Already running at:
ssh root@187.77.156.215
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

**Access:**
- Frontend: http://187.77.156.215:5173
- Backend: http://187.77.156.215:8000
- Database: 5433

**Features:**
- No development flags (--reload disabled)
- Production-optimized startup
- Automatic restart on failure
- Health checks enabled
- Read-only storage mount for frontend

### Production Deployment Workflow

**Only modify production after staging validation:**

```bash
cd /Users/Nattawee.S/ces_sale_operation

# Create backup before every deploy (run from Mac)
./backup-production.sh

ssh root@187.77.156.215

# Navigate to production folder
cd /root/ces_sale_operation_system

# Pull latest main branch
git fetch origin
git checkout main
git pull --ff-only origin main

# Rebuild (if Dockerfile/dependencies changed)
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# Restart services with new images
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run migrations
docker exec \
   $(docker compose -f docker-compose.prod.yml --env-file .env.prod ps -q backend) \
   alembic upgrade head

# Verify health
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl http://localhost:8000/health
```

### Production Backup Strategy

Before each production deploy, back up these assets:
- Production PostgreSQL database
- Production config files (`docker-compose.prod.yml`, `.env.prod`)
- Uploaded/storage files under `/app/storage`
- Current git commit metadata

Use:

```bash
cd /Users/Nattawee.S/ces_sale_operation
./backup-production.sh
```

Backups are stored on the VPS under:

```bash
/root/ces_sale_operation_backups/production/<timestamp>/
```

Each backup directory contains:
- `db.dump`
- `storage.tgz`
- `config_snapshot.tgz`
- `metadata.env`
- `compose_ps.txt`
- `git_commit.txt`

### Daily VPS Backup Automation (Keep 3)

Repository scripts are available in `scripts/backup/`:
- `scripts/backup/ces-prod-backup.sh`
- `scripts/backup/ces-prod-restore.sh`
- `scripts/backup/backup-notify.env.example`

These scripts are intended to run on the VPS and keep only the latest 3 backups.

Deploy scripts to VPS:

```bash
scp scripts/backup/ces-prod-backup.sh root@187.77.156.215:/root/backup-scripts/ces-prod-backup.sh
scp scripts/backup/ces-prod-restore.sh root@187.77.156.215:/root/backup-scripts/ces-prod-restore.sh
chmod +x /root/backup-scripts/ces-prod-backup.sh /root/backup-scripts/ces-prod-restore.sh
```

Configure daily schedule at 01:00:

```bash
( crontab -l 2>/dev/null | grep -v 'ces-prod-backup.sh' ; echo "0 1 * * * /root/backup-scripts/ces-prod-backup.sh >> /var/log/ces-prod-backup.log 2>&1" ) | crontab -
```

Optional Telegram notifications:

```bash
scp scripts/backup/backup-notify.env.example root@187.77.156.215:/root/backup-scripts/backup-notify.env.example
cp /root/backup-scripts/backup-notify.env.example /root/backup-scripts/backup-notify.env
# edit TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
chmod 600 /root/backup-scripts/backup-notify.env
```

Run one manual test:

```bash
/root/backup-scripts/ces-prod-backup.sh
```

### Production Rollback Strategy

If a production deploy fails after startup or breaks application behavior:

```bash
cd /Users/Nattawee.S/ces_sale_operation
./rollback-production.sh latest
```

This rollback process will:
- Restore the saved production config snapshot
- Check out the previous git commit on the VPS
- Restore the PostgreSQL dump
- Restore `/app/storage`
- Rebuild and restart the production stack

This is why rollback is safer than `alembic downgrade` for production: it restores the full database and storage state together.

To restore a specific backup:

```bash
./rollback-production.sh 20260407_154500
```

## Local Mac → Staging → Production Flow

### Step 1: Local Development
```bash
# On Mac
cd /Users/Nattawee.S/ces_sale_operation

# Make changes to backend and/or frontend
# Test locally at http://localhost:5173

# Commit changes
git add .
git commit -m "Feature: description"
git push origin develop
```

### Step 2: Deploy to Staging
```bash
# On VPS
ssh root@187.77.156.215

cd /root/ces_sale_operation_system_staging

# Pull latest develop branch
git fetch origin
git checkout develop
git pull

# Rebuild and restart
docker compose -f docker-compose.staging.yml --env-file .env.staging build
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d

# Run migrations
docker exec \
   $(docker compose -f docker-compose.staging.yml --env-file .env.staging ps -q backend) \
   alembic upgrade head

# Test at http://187.77.156.215:5174
```

### Step 3: Validate and Merge to Production
```bash
# After staging validation, merge to main (on GitHub or local)
git checkout main
git merge develop
git push origin main
```

### Step 4: Deploy to Production
```bash
# On VPS
ssh root@187.77.156.215

cd /root/ces_sale_operation_system

# Pull latest main branch
git fetch origin
git checkout main
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run migrations
docker exec \
   \$(docker compose -f docker-compose.prod.yml --env-file .env.prod ps -q backend) \
   alembic upgrade head

# Verify
curl http://localhost:8000/health
```

## Key Differences

| Aspect | Local Dev | Staging | Production |
|--------|-----------|---------|------------|
| **Compose File** | docker-compose.yml | docker-compose.staging.yml | docker-compose.prod.yml |
| **Env File** | (none) | .env.staging | .env.prod |
| **Frontend Port** | 5173 | 5174 | 5173 |
| **Backend Port** | 8000 | 8001 | 8000 |
| **Database Port** | 5433 | 5434 | 5433 |
| **Backend CMD** | --reload | --reload | (production mode) |
| **Frontend CMD** | npm run dev | npm run dev | npm run preview |
| **File Mounts** | Mounted | Mounted | No direct mounts |
| **Hot Reload** | Yes | Yes | No |
| **Health Checks** | No | Yes | Yes |

## Environment Variables

### .env.prod
- `DB_PASSWORD`: Production database password
- `SECRET_KEY`: Production JWT secret (CHANGE THIS)
- `FRONTEND_ORIGIN`: Production frontend URL
- `API_BASE_URL`: Backend API URL for frontend

### .env.staging
- Same structure as prod but with staging values
- Used for testing config changes before production

## Troubleshooting

### Check Logs
```bash
# Local
docker compose logs -f backend

# Staging
ssh root@187.77.156.215
docker compose -f docker-compose.staging.yml --env-file .env.staging logs -f backend

# Production
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
```

### Rebuild Services
```bash
# Include all cached dependencies
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Database Issues
```bash
# Backup production database
ssh root@187.77.156.215
docker exec ces_sale_operation_system-db-1 pg_dump -U ces -d ces_sale_operation > backup_$(date +%s).sql

# Check database size
docker exec ces_sale_operation_system-db-1 psql -U ces -d ces_sale_operation -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database WHERE datname = 'ces_sale_operation';"
```

## Important Notes

1. **NEVER** directly edit production files via SSH. Always go through version control:
   - Change → Commit → Push
   - Test in Staging
   - Merge to main
   - Deploy to Production

2. **Production .env.prod must have secure values:**
   - Use strong `SECRET_KEY` (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
   - Use strong `DB_PASSWORD` 
   - Update `FRONTEND_ORIGIN` to your actual domain

3. **Staging is for validation only:**
   - Use it to test database migrations
   - Test new API endpoints
   - Verify UI changes before production

4. **Keep backups:**
   - Before major deployments, backup the production database
   - Backup config and storage together with the database
   - Test restore procedure regularly
   - Keep at least one known-good rollback point before each production release

5. **Run migrations only through deploy flow:**
   - Local: run migrations manually while developing
   - Staging/Production: let deploy scripts run `alembic upgrade head`
   - Avoid manual schema changes directly in PostgreSQL

## Git Workflow

```
main (production) ← develop (staging) ← feature branches (local)
  ↓                  ↓
  Production         Staging
  (port 5173)        (port 5174)
```

**Branch Protection:**
- `main`: Deploy-ready code only, requires staging validation
- `develop`: Integration branch for staging, may contain experimental code
- `feature/*`: Feature development on local Mac
