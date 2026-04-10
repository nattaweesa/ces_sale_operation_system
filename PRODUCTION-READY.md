# 🚀 Production-Ready Deployment Setup

## ✅ What's Been Set Up

Your CES Sales Operation project is now ready for professional production deployment with separate environments:

### 📦 **Three Isolated Environments**

```
┌─────────────────────┐
│   Local Mac Dev     │  → Test locally first
│  Port 5173 (Dev)    │     docker-compose up -d
└─────────────────────┘
           ↓ git push origin develop
┌─────────────────────┐
│  Staging - VPS      │  → Validate changes
│  Port 5174 (Test)   │     ./deploy-staging.sh quick
└─────────────────────┘
           ↓ git merge develop → main  
┌─────────────────────┐
│ Production - VPS    │  → Live users
│  Port 5173 (Live)   │     ./deploy-production.sh quick
└─────────────────────┘
```

### 📋 **Files Created**

**Configuration Files:**
- `docker-compose.prod.yml` - Production Docker setup (optimized, no dev flags)
- `docker-compose.staging.yml` - Staging Docker setup (with --reload for testing)
- `.env.prod` - Production environment variables
- `.env.staging` - Staging environment variables

**Automation Scripts:**
- `deploy-production.sh` - One-command production deployment
- `deploy-staging.sh` - One-command staging deployment
- `vps-setup-staging.sh` - One-time VPS staging initialization

**Documentation:**
- `DEPLOYMENT.md` - Complete technical reference (detailed)
- `DEPLOY-QUICK-START.md` - Quick start guide (recommended reading)
- `VPS-SETUP.md` - VPS initial setup instructions
- `PRODUCTION-READY.md` - This file

---

## 🚀 Typical Workflow

### 1. **Make Changes Locally** (Mac)
```bash
cd /Users/Nattawee.S/ces_sale_operation

# Edit your code
vim backend/app/api/something.py
vim frontend/src/pages/SomePage.tsx

# Test locally
docker-compose up -d
# Open http://localhost:5173

# Commit when ready
git add .
git commit -m "Feature: Add new report"
git push origin develop  # or feature branch
```

### 2. **Test in Staging** (VPS Port 5174)
```bash
# Deploy to staging environment
./deploy-staging.sh quick

# Test your changes
open http://187.77.156.215:5174

# Check logs if needed
ssh root@187.77.156.215
docker-compose -f /root/ces_sale_operation_system_staging/docker-compose.staging.yml logs -f backend
```

### 3. **Merge to Production-Ready** (Git)
```bash
# After staging looks good
git checkout main
git merge develop
git push origin main
```

### 4. **Deploy to Production** (VPS Port 5173)
```bash
# Deploy to production
./deploy-production.sh quick

# Verify at http://187.77.156.215:5173
```

---

## 📊 Environment Comparison

| Aspect | Local | Staging | Production |
|--------|-------|---------|------------|
| **Location** | Mac | VPS 187.77.156.215 | VPS 187.77.156.215 |
| **Frontend Port** | 5173 | 5174 | 5173 |
| **Backend Port** | 8000 | 8001 | 8000 |
| **DB Port** | 5433 | 5434 | 5433 |
| **Git Branch** | feature-* / develop | develop | main |
| **Dev Mode** | Yes (--reload) | Yes (--reload) | No |
| **Data** | Local only | Separate DB | Production data |
| **Users** | Test accounts | Staging users | Real users |
| **Purpose** | Development | Validation | Live service |

---

## 🎛 Deployment Commands

### Quick Deploy (Code Changes)
```bash
# Fastest - just restart with new code
./deploy-production.sh quick   # 30 seconds
./deploy-staging.sh quick      # 30 seconds
```

### Full Deploy (Dependency Changes)
```bash
# Slower but rebuilds everything
./deploy-production.sh build   # 2-5 minutes  
./deploy-staging.sh build      # 2-5 minutes
```

---

## ⚙️ VPS Staging Setup (One-time)

**From Mac:**
```bash
ssh root@187.77.156.215 < /Users/Nattawee.S/ces_sale_operation/vps-setup-staging.sh
```

**What it does:**
- Creates `/root/ces_sale_operation_system_staging`
- Sets up git remote pointing to your repository
- Checks out `develop` branch
- Starts Docker services on ports 5174/8001
- Initializes separate database for staging

After setup, staging and production run separately on the VPS.

---

## 🔒 Important Rules

### ✅ **DO THIS:**
- Make changes locally first
- Test locally at http://localhost:5173
- Deploy to staging to validate
- Use develop branch for staging deployments
- Use main branch for production deployments
- Always commit before deploying
- Check logs if deployment fails

### ❌ **DON'T DO THIS:**
- Edit files directly on VPS via SSH
- Deploy without committing to git
- Modify production files directly
- Mix code from both branches in staging
- Skip staging validation
- Push to main without testing
- Use production folder for testing

---

## 📈 Daily Workflow Summary

**You only need to run:**

1. **Local development** (always)
   ```bash
   docker-compose up -d  # once when you start
   # Make changes, test at http://localhost:5173
   ```

2. **When ready to share**
   ```bash
   git push origin develop
   ./deploy-staging.sh quick
   # Test at http://187.77.156.215:5174
   ```

3. **When validated and ready for users**
   ```bash
   git checkout main
   git merge develop  
   git push origin main
   ./deploy-production.sh quick
   # Live at http://187.77.156.215:5173
   ```

---

## 📚 For More Information

- **Quick reference**: See [DEPLOY-QUICK-START.md](./DEPLOY-QUICK-START.md)
- **Detailed guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **VPS setup**: See [VPS-SETUP.md](./VPS-SETUP.md)
- **Troubleshooting**: See [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting)

---

## 🎉 You're Ready!

Your production deployment infrastructure is now configured:

✅ Production environment isolated on VPS (port 5173)
✅ Staging environment on separate ports (5174)
✅ Local development setup maintained
✅ One-command deployment scripts
✅ Automatic git/docker orchestration
✅ Proper branch workflow (develop → main)
✅ Separate databases per environment
✅ Health checks and monitoring enabled

**Next Steps:**
1. Review [DEPLOY-QUICK-START.md](./DEPLOY-QUICK-START.md)
2. Run VPS staging setup: `ssh root@187.77.156.215 < vps-setup-staging.sh`
3. Deploy staging: `./deploy-staging.sh quick`
4. Test at http://187.77.156.215:5174
5. Start using the new workflow! 🚀

