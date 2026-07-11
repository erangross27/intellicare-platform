# IntelliCare Backup & Restore System

## 📦 Current Implementation (January 2025)

### Automated Backup System
- **Schedule**: Daily at 9:00 PM (21:00)
- **Storage**: `/apps/backend-api/backups/`
- **Encryption**: AES-256-GCM with master recovery key
- **Compression**: ZIP format (Windows compatible)
- **Retention**: 30 days of backups

### Master Recovery Key
```
<ENCRYPTION_KEY>
```
**⚠️ CRITICAL**: Store this key in a secure location outside the production system

### Emergency Restore Commands

#### Full System Restore
```bash
node emergency-restore.js --key=<ENCRYPTION_KEY> --backup=backups/backup-2025-01-13.enc
```

#### Dual-Control Restore (if key is split)
```bash
node emergency-restore.js --part1=<ENCRYPTION_KEY> --part2=<ENCRYPTION_KEY> --backup=backups/backup-2025-01-13.enc
```

#### Manual Backup Trigger
```bash
node run-backup-now.js
```

#### Test Backup Integrity
```bash
node test-backup-extract.js
```

---

## 🔮 Future Enhancement: Chat-Based Restore Interface

### Planned Features for Production

#### 1. Natural Language Backup Management

**Admin Chat Commands**:
```javascript
// Backup Operations
"Show me available backups"
"Create an emergency backup now"
"What's the status of our backups?"
"When was the last backup?"

// Restore Operations
"Restore from yesterday's backup"
"Restore the database from January 13"
"Show me what changed since the last backup"
"Restore just the patient data from last week"

// Verification
"Verify backup integrity for today"
"Test if we can restore from the latest backup"
"Show backup health report"
```

#### 2. Implementation Architecture

##### A. Agent Service Integration
```javascript
// In agentServiceV4.js - Add backup management functions
{
  name: 'listBackups',
  description: 'List all available backup files',
  parameters: {
    limit: { type: 'number', description: 'Number of backups to show' },
    showDetails: { type: 'boolean', description: 'Include size and contents' }
  },
  requiresRole: ['admin', 'super-admin']
}

{
  name: 'restoreFromBackup',
  description: 'Restore system from a backup file',
  parameters: {
    backupId: { type: 'string', description: 'Backup identifier or date' },
    mode: { 
      type: 'string', 
      enum: ['full', 'selective', 'merge'],
      description: 'Restore mode'
    },
    collections: {
      type: 'array',
      description: 'Specific collections to restore (selective mode only)'
    }
  },
  requiresRole: ['super-admin'],
  requires2FA: true
}

{
  name: 'createBackup',
  description: 'Create immediate backup',
  parameters: {
    description: { type: 'string', description: 'Backup description' },
    includeKMS: { type: 'boolean', description: 'Include KMS keys' }
  },
  requiresRole: ['admin']
}

{
  name: 'compareBackup',
  description: 'Compare current state with backup',
  parameters: {
    backupId: { type: 'string', description: 'Backup to compare with' },
    showDiff: { type: 'boolean', description: 'Show detailed differences' }
  },
  requiresRole: ['admin']
}
```

##### B. Safety Features

**Pre-Restore Checklist**:
1. **Authentication**: Admin role + 2FA verification
2. **Auto-Backup**: Create snapshot before any restore
3. **Preview Mode**: Show what will be changed
4. **Confirmation**: Require explicit confirmation
5. **Rollback**: Keep temporary copy for quick rollback

**Progressive Restore Options**:
```javascript
// Restore Modes
const restoreModes = {
  'full': 'Replace everything with backup',
  'selective': 'Restore specific collections only',
  'merge': 'Merge backup with current data',
  'point-in-time': 'Restore to specific timestamp',
  'practice-only': 'Restore single practice data'
};
```

#### 3. User Experience Design

##### A. Chat Flow Example
```
User: "I need to restore yesterday's data"

AI: "I can help you restore from yesterday's backup. Let me check what's available.

📦 Found backup from January 12, 2025 at 9:00 PM
- Size: 145 MB
- Contains: 2 databases, 192 service accounts
- Status: ✅ Verified

Before we proceed:
1. I'll create a safety backup of current data
2. Show you what will change
3. Need your admin 2FA code

Shall I proceed with the safety backup first?"

User: "Yes, proceed"

AI: "Creating safety backup... ✅ Done (backup-safety-2025-01-13-1834.enc)

Here's what will be restored:
- 🔄 Patient records: 1,250 documents
- 🔄 Appointments: 450 documents  
- ⚠️ 5 records created today will be overwritten

Please enter your 2FA code to confirm restore:"

User: "123456"

AI: "✅ 2FA verified. Starting restore...

[Progress Bar: ████████████████████] 100%

✅ Restore completed successfully!
- Restored 1,700 documents
- Time taken: 45 seconds
- Safety backup saved as: backup-safety-2025-01-13-1834.enc

Your system is now restored to January 12, 2025 at 9:00 PM."
```

##### B. Visual Dashboard Components

```javascript
// Future React Component
<BackupDashboard>
  <BackupTimeline />
  <BackupHealth />
  <QuickActions>
    <Button>Backup Now</Button>
    <Button>Restore</Button>
    <Button>Verify</Button>
  </QuickActions>
  <BackupHistory>
    {backups.map(backup => (
      <BackupCard 
        date={backup.date}
        size={backup.size}
        status={backup.verified}
        actions={['restore', 'download', 'delete']}
      />
    ))}
  </BackupHistory>
</BackupDashboard>
```

#### 4. Advanced Features

##### A. Intelligent Restore
- **Conflict Resolution**: Smart merging of conflicting data
- **Dependency Management**: Restore related data together
- **Validation**: Pre-restore data integrity checks
- **Optimization**: Only restore changed data (delta restore)

##### B. Backup Analytics
```javascript
// AI-Powered Insights
"Your backup patterns show:
- Average daily data growth: 12 MB
- Peak backup times: Wednesdays
- Suggested optimization: Enable incremental backups
- Risk assessment: Low (regular backups, verified integrity)"
```

##### C. Multi-Region Support
```javascript
// Geo-Redundant Backups
const backupRegions = {
  primary: 'us-east-1',
  secondary: 'eu-west-1',
  tertiary: 'ap-southeast-1'
};

// Cross-region restore
"Restore from European backup server"
"Failover to Asian backup region"
```

#### 5. Implementation Roadmap

**Phase 1: Basic Chat Integration** (2-3 days)
- List backups command
- Create backup command
- Basic restore with confirmation

**Phase 2: Safety Features** (3-4 days)
- 2FA integration
- Auto-backup before restore
- Preview/dry-run mode
- Rollback capability

**Phase 3: Advanced Restore** (1 week)
- Selective restore
- Merge mode
- Point-in-time recovery
- Practice-specific restore

**Phase 4: Visual Dashboard** (1 week)
- React components
- Timeline visualization
- Progress indicators
- Health monitoring

**Phase 5: Intelligence** (2 weeks)
- Backup analytics
- Anomaly detection
- Optimization suggestions
- Predictive storage needs

#### 6. Security Considerations

**Access Control**:
```javascript
const backupPermissions = {
  'view_backups': ['admin', 'backup-operator'],
  'create_backup': ['admin', 'backup-operator'],
  'restore_backup': ['super-admin'],
  'delete_backup': ['super-admin'],
  'download_backup': ['super-admin', 'compliance-officer']
};
```

**Audit Trail**:
- Log all backup/restore operations
- Track who initiated restore
- Record what was changed
- Maintain compliance records

**Encryption at Rest**:
- Backups encrypted with AES-256-GCM
- Keys stored in separate KMS
- Support for customer-managed keys
- Compliance with HIPAA/GDPR

---

## 📋 Quick Reference

### Current System Files
- **Backup Service**: `/services/backupService.js`
- **Emergency Restore**: `/emergency-restore.js`
- **Recovery Key Generator**: `/generate-recovery-key.js`
- **Manual Backup**: `/run-backup-now.js`
- **Test Extraction**: `/test-backup-extract.js`

### Environment Variables
```bash
# Not used (KMS only)
# BACKUP_ENCRYPTION_KEY stored in KMS
# MASTER_RECOVERY_KEY stored in KMS
```

### Monitoring Commands
```bash
# Check backup service status
curl http://localhost:5000/api/backup/status

# List available backups
curl http://localhost:5000/api/backup/list

# Trigger manual backup (requires admin auth)
curl -X POST http://localhost:5000/api/backup/manual
```

---

## 🚨 Disaster Recovery Procedure

### If Total System Failure Occurs:

1. **Get the recovery key** from secure storage
2. **Locate latest backup** in `/backups/` directory
3. **Run emergency restore**:
   ```bash
   node emergency-restore.js --key=[RECOVERY_KEY] --backup=[BACKUP_FILE]
   ```
4. **Verify restoration**:
   ```bash
   node test-backup-extract.js
   ```
5. **Start services**:
   ```bash
   npm run dev
   ```

### Recovery Time Objectives
- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 24 hours
- **Backup Window**: Daily at 21:00
- **Retention Period**: 30 days

---

*Last Updated: January 2025*
*Next Review: April 2025*