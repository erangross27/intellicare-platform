# IntelliCare Windows to Ubuntu Migration Checklist

## 📋 Pre-Migration (Windows)

### 1. Backup Preparation
- [ ] Stop all active user sessions
- [ ] Notify users of maintenance window
- [ ] Run final backup verification
- [ ] Document current MongoDB passwords
- [ ] Export all environment variables
- [ ] Save current SSL certificates

### 2. Create Full Backup
```powershell
# Run as Administrator
.\BACKUP-WINDOWS-FULL.ps1
```
- [ ] MongoDB data exported (all databases)
- [ ] MongoDB users and roles exported
- [ ] KMS keys backed up (.kms folder)
- [ ] KMS storage backed up (plain text keys)
- [ ] Environment files saved (.env files)
- [ ] Application code copied (without node_modules)
- [ ] Redis/Memurai data exported
- [ ] Logs and audit trails preserved
- [ ] Dependencies documented

### 3. Secure Backup
- [ ] Compress backup folder with encryption
```powershell
7z a -p -mhe=on IntelliCare_Backup.7z IntelliCare_Backup_*
```
- [ ] Transfer encrypted backup to Ubuntu server
- [ ] Verify backup integrity after transfer

## 🐧 Ubuntu Setup (Fresh Ubuntu 22.04/24.04 LTS)

### 4. Initial Ubuntu Configuration
```bash
# Run on Ubuntu server
chmod +x scripts/setup/UBUNTU-SETUP.sh
./scripts/setup/UBUNTU-SETUP.sh
```
- [ ] System packages updated
- [ ] Node.js 18 LTS installed
- [ ] MongoDB 6.0 installed with replica set support
- [ ] Redis installed (replaces Memurai)
- [ ] PM2 installed for process management
- [ ] Firewall configured (UFW)
- [ ] Directory structure created
- [ ] Systemd services configured

### 5. Transfer and Extract Backup
- [ ] Transfer encrypted backup to Ubuntu server
- [ ] Extract backup with password
```bash
7z x IntelliCare_Backup.7z
```
- [ ] Verify all files extracted successfully

### 6. Restore Data
```bash
chmod +x scripts/setup/RESTORE-FROM-WINDOWS.sh
./scripts/setup/RESTORE-FROM-WINDOWS.sh ~/IntelliCare_Backup_*
```
- [ ] Application code restored
- [ ] Security keys and KMS data restored
- [ ] Environment files restored
- [ ] Configuration updated for Linux paths
- [ ] NPM dependencies installed
- [ ] MongoDB data restored
- [ ] Redis data imported
- [ ] Logs and backups restored

## 🔐 Security Configuration

### 7. MongoDB Security
- [ ] Update MongoDB passwords in init script
```bash
nano ~/IntelliCare/init-mongodb.sh
# Change CHANGE_THIS_PASSWORD to secure passwords
```
- [ ] Initialize MongoDB security
```bash
./init-mongodb.sh
```
- [ ] Verify authentication works
```bash
mongosh -u intellicare_app -p YOUR_PASSWORD --authenticationDatabase admin
```

### 8. Update Environment Variables
- [ ] Edit backend .env file
```bash
nano ~/IntelliCare/apps/backend-api/.env
```
- [ ] Update all API keys if needed
- [ ] Verify Redis connection string (not Memurai)
- [ ] Update file paths to Linux format

### 9. SSL/TLS Configuration
- [ ] Install SSL certificates
- [ ] Configure Nginx as reverse proxy
- [ ] Update domain DNS records
- [ ] Test HTTPS connectivity

## ✅ Verification

### 10. Service Startup
```bash
# Start all services
./manage-services.sh start

# Check status
./manage-services.sh status
```
- [ ] MongoDB running and accessible
- [ ] Redis running with data
- [ ] Backend API responding (port 5000)
- [ ] Frontend accessible (port 3000)

### 11. Application Testing
```bash
# Run verification script
./verify-migration.sh
```
- [ ] Login functionality works
- [ ] Database queries successful
- [ ] Redis caching operational
- [ ] Claude API integration working
- [ ] Email/SMS services functional
- [ ] File uploads working

### 12. Data Integrity
- [ ] Verify all practices exist in database
- [ ] Check user accounts accessible
- [ ] Confirm patient data intact
- [ ] Test document retrieval
- [ ] Verify audit logs present

## 🚀 Go-Live

### 13. Production Readiness
- [ ] Configure production domain
- [ ] Set up SSL certificates
- [ ] Enable automated backups
- [ ] Configure monitoring
- [ ] Set up log rotation
- [ ] Test disaster recovery

### 14. DNS Cutover
- [ ] Update DNS A records to Ubuntu IP
- [ ] Monitor DNS propagation
- [ ] Test with production domain
- [ ] Verify SSL certificate valid

### 15. Post-Migration
- [ ] Monitor error logs for 24 hours
- [ ] Check performance metrics
- [ ] Verify all integrations working
- [ ] Document any issues found
- [ ] Create Ubuntu-specific runbook
- [ ] Train team on new environment

## 📝 Important Notes

### Key Differences on Ubuntu
1. **Redis instead of Memurai**: Standard Redis replaces Windows Memurai
2. **File paths**: All paths now use forward slashes (/)
3. **Services**: systemd services replace Windows services
4. **Permissions**: Linux file permissions (chmod/chown)
5. **Logs**: Journalctl for system logs

### Common Commands
```bash
# Service management
sudo systemctl start/stop/restart intellicare-backend
sudo systemctl start/stop/restart intellicare-frontend

# View logs
sudo journalctl -u intellicare-backend -f
tail -f ~/IntelliCare/logs/backend-error.log

# MongoDB access
mongosh -u intellicare_app -p PASSWORD --authenticationDatabase admin

# Redis access
redis-cli
> AUTH your_redis_password
> INFO
> KEYS *

# Backup
~/IntelliCare/backup.sh
```

### Rollback Plan
If migration fails:
1. Keep Windows server running until verified
2. Have encrypted backup ready for re-restoration
3. Document all configuration changes
4. Test rollback procedure before go-live

## 📞 Support Contacts
- MongoDB Issues: Check replica set status
- Redis Issues: Verify persistence configuration
- Network Issues: Check UFW firewall rules
- Application Issues: Review service logs

## ⏱️ Estimated Timeline
- Pre-migration backup: 30-60 minutes
- Ubuntu setup: 30 minutes
- Data restoration: 60-90 minutes
- Configuration & testing: 2-3 hours
- DNS cutover: 1-48 hours (propagation)
- **Total downtime**: 4-6 hours (excluding DNS)