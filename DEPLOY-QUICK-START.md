# Production Deployment Quick Start

## Overview

Three environments with separate deployments and data:

```
Local Mac (Development)
  ↓ git push origin develop
Staging - VPS:5174 (Testing)
  ↓ merge develop → main
Production - VPS:5173 (Live)
```

## Quick Commands

### 1. Local Development (Mac)
```bash
cd /Users/Nattawee.S/ces_sale_operation

# Start all services locally
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```
**Access:** http://localhost:5173

---

### 2. Deploy to Staging (for testing)
```bash
cd /Users/Nattawee.S/ces_sale_operation

# Make your changes and commit
git add .
git commit -m "Your feature"
git push origin develop  # OR your feature branch

# Deploy to staging VPS (quick restart)
./deploy-staging.sh quick

# OR full rebuild if dependencies changed
./deploy-staging.sh build
```
**Access:** http://187.77.156.215:5174
**Test** - If looks good, proceed to production

These staging deploy commands also run database migrations automatically:
```bash
alembic upgrade heads
```

---

### 3. Deploy to Production (keep port 5173)
```bash
cd /Users/Nattawee.S/ces_sale_operation

# Ensure you're on main branch and everything is committed
git checkout main
git pull origin main

# Merge tested feature from develop
git merge origin/develop
git push origin main

# Deploy to production (auto backup DB + config + storage first)
./deploy-production.sh quick

# OR full rebuild if dependencies changed
./deploy-production.sh build
```
**Access:** http://187.77.156.215:5173

These production deploy commands also:
- create a pre-deploy backup automatically
- run `alembic upgrade heads`
- fail the deploy if migrations or health checks fail

Important: deploy scripts only run Alembic upgrades. They do not automatically downgrade or remove a migration if you reset git back to an older commit. If a bad migration reached production, verify and repair DB state explicitly or restore from a backup.

---

## Deployment Methods

### Quick Deploy (Code Changes Only)
```bash
./deploy-production.sh quick
# Takes ~30 seconds
# Creates pre-deploy backup first
# Runs alembic upgrade heads
# No Dockerfile rebuild
# Services restart and pull latest git code
```

### Full Deploy (Dependency Changes)
```bash
./deploy-production.sh build
# Takes 2-5 minutes
# Creates pre-deploy backup first
# Runs alembic upgrade heads
# Rebuilds Docker images
# Installs all dependencies fresh
# Then restarts services
```

### Manual Backup Before Risky Changes
```bash
./backup-production.sh
```

This creates a VPS backup set containing:
- PostgreSQL production dump
- Production config snapshot (`docker-compose.prod.yml` and `.env.prod`)
- Uploaded/storage files snapshot
- Git commit metadata

### Rollback Production
```bash
./rollback-production.sh latest
```

If you need a specific restore point instead of the latest backup:
```bash
./rollback-production.sh 20260407_154500
```

---

## What's Running Where?

| Environment | Frontend | Backend | DB |
|-----------|----------|---------|-----|
| **Local Mac** | :5173 | :8000 | :5433 |
| **Staging VPS** | :5174 | :8001 | :5434 |
| **Production VPS** | :5173 | :8000 | :5433 |

---

## Step-by-Step: Your Typical Workflow

### 1️⃣ Make Changes Locally
```bash
cd /Users/Nattawee.S/ces_sale_operation

# Edit files (e.g., frontend components, backend APIs)
# Test locally at http://localhost:5173

# Commit changes
git add .
git commit -m "Feature: Add new report page"
git push origin develop
```

### 2️⃣ Test in Staging
```bash
# SSH to VPS (optional, to verify)
# OR just go to: http://187.77.156.215:5174 in your browser

# Deploy staging
./deploy-staging.sh quick

# Test your changes
# Check logs if issues:
# ssh root@187.77.156.215
# docker compose -f /root/ces_sale_operation_system_staging/docker-compose.staging.yml --env-file /root/ces_sale_operation_system_staging/.env.staging logs -f backend
```

### 3️⃣ Merge to Main
```bash
# After staging validation
git checkout main
git merge develop
git push origin main

# Or merge via GitHub Pull Request (recommended)
```

### 4️⃣ Deploy Production
```bash
# Deploy production
./deploy-production.sh quick

# Verify at: http://187.77.156.215:5173
```

During deploy, migrations run automatically inside the backend container.

### 5️⃣ Roll Back If Production Fails
```bash
# Restore latest backup and previous commit
./rollback-production.sh latest
```

If the failure involved an Alembic migration, do not assume git rollback is enough. Confirm all three match:

```bash
ssh root@187.77.156.215
cd /srv/ces_sale_operation_system
git rev-parse --short HEAD
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker exec \
  $(docker compose -f docker-compose.prod.yml --env-file .env.prod ps -q backend) \
  alembic current
```

Also verify the affected endpoint directly from the VPS, for example:

```bash
curl -fsS http://localhost:8000/health
curl -i http://localhost:8000/deals
```

`/deals` without a token should return `401 Unauthorized`, not `500 Internal Server Error`.

---

## Common Issues

### ❌ "Permission denied" running deploy scripts
```bash
chmod +x ./deploy-*.sh
```

### ❌ Production deployment fails because not on main
```bash
git checkout main
git pull origin main
./deploy-production.sh quick
```

### ❌ Docker containers won't start
```bash
# Check logs
ssh root@187.77.156.215
cd /srv/ces_sale_operation_system
docker compose -f docker-compose.prod.yml --env-file .env.prod logs

# Or rebuild from scratch
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### ❌ Need to pull staging/production files quickly
```bash
# View production logs
ssh root@187.77.156.215 'docker compose -f /srv/ces_sale_operation_system/docker-compose.prod.yml --env-file /srv/ces_sale_operation_system/.env.prod logs -f backend | tail -50'

# View staging logs
ssh root@187.77.156.215 'docker compose -f /root/ces_sale_operation_system_staging/docker-compose.staging.yml --env-file /root/ces_sale_operation_system_staging/.env.staging logs -f backend | tail -50'
```

---

## Important Rules

✅ **DO:**
- Make changes on Mac, test locally first
- Use `develop` branch for staging
- Use `main` branch for production
- Always test in staging before production
- Commit before deploying
- Keep the latest successful production backup
- Run rollback immediately if health checks fail after deploy
- For model/schema changes, backfill old rows and make serializers tolerate legacy/null values during transition
- Verify Alembic heads/current and the actual DB schema after deploy or rollback
- Verify the exact API endpoint affected by the model change, not only `/health`

❌ **DON'T:**
- Edit production files directly via SSH
- Deploy without git commit
- Use production branch for experimental code
- Skip staging validation
- Forget to push before deploying
- Force-push `main` as a rollback plan without checking the VPS commit and DB migration state
- Remove or downgrade a deployed migration casually without checking production data and backups

---

## Full Documentation

For detailed setup, troubleshooting, and advanced topics, see [DEPLOYMENT.md](./DEPLOYMENT.md)
