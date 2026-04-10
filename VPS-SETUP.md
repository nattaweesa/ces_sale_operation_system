# VPS Setup Instructions

This directory contains everything needed for production/staging deployment on the VPS.

## Current VPS Setup

```
187.77.156.215
├── /root/ces_sale_operation_system (Production)
│   ├── docker-compose.prod.yml
│   ├── backend/
│   ├── frontend/
│   └── Port 5173 (Frontend) + 8000 (Backend)
│
└── /root/ces_sale_operation_system_staging (Staging - NEW)
    ├── docker-compose.staging.yml
    ├── backend/
    ├── frontend/
    └── Port 5174 (Frontend) + 8001 (Backend)
```

## Getting Set Up

### 1. Copy Docker Compose Files to VPS

These files are already on Mac at the root of the project:
- `docker-compose.prod.yml` - Production configuration
- `docker-compose.staging.yml` - Staging configuration  
- `.env.prod` - Production environment variables
- `.env.staging` - Staging environment variables

They need to be copied to VPS production folder.

### 2. Initialize Staging on VPS

On VPS, run the setup script:

```bash
ssh root@187.77.156.215 < /Users/Nattawee.S/ces_sale_operation/vps-setup-staging.sh
```

Or manually:

```bash
# SSH into VPS
ssh root@187.77.156.215

# Create staging folder from production
mkdir -p /root/ces_sale_operation_system_staging
cd /root/ces_sale_operation_system_staging

# Clone from production's git remote
git init
git remote add origin <same remote as production>
git fetch origin
git checkout develop

# Start staging
docker-compose -f docker-compose.staging.yml --env-file .env.staging up -d
```

### 3. Update Production Docker Compose

Update `/root/ces_sale_operation_system/docker-compose.prod.yml` to use the optimized production config (remove --reload flag).

## Post-Setup Verification

After setup, verify both environments are running:

```bash
ssh root@187.77.156.215

# Check production
echo "📱 Production:"
docker-compose -f /root/ces_sale_operation_system/docker-compose.prod.yml ps

# Check staging
echo "📱 Staging:"
docker-compose -f /root/ces_sale_operation_system_staging/docker-compose.staging.yml ps

# Test health
echo "Backend health:"
curl http://localhost:8000/health
curl http://localhost:8001/health
```

Expected output:
- 3-4 services running in production (db, backend, frontend, optionally nginx)
- 3-4 services running in staging (db, backend, frontend, optionally nginx)
- Both health checks return 200 OK

## Deployment After Setup

From Mac:

```bash
cd /Users/Nattawee.S/ces_sale_operation

# Test changes locally first
docker-compose up -d

# Deploy to staging
./deploy-staging.sh quick

# When ready, deploy to production
./deploy-production.sh quick
```

See [DEPLOY-QUICK-START.md](./DEPLOY-QUICK-START.md) for full workflow.
