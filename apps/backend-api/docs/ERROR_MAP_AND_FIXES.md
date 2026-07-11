# IntelliCare Error Map and Fix Plan
**Generated: 2025-09-15**

## Executive Summary
- **Total Unique Error Types**: 3 main categories
- **Affected Services**: 15 services
- **Root Cause**: Database collection mismatch (ServiceAccount vs serviceaccounts)
- **Impact**: Services work but log errors continuously

## Error Categories

### 1. Service Not Found Errors (30 occurrences)
These services are not found in the ServiceAccount collection:

| Service ID | Error Count | Status |
|------------|-------------|---------|
| billing-service | 2 | Missing from ServiceAccount |
| blue-button-oauth-service | 2 | Missing from ServiceAccount |
| bulk-communication-service | 2 | Missing from ServiceAccount |
| calendar-sync-service | 2 | Missing from ServiceAccount |
| communication-audit-service | 2 | Missing from ServiceAccount |
| drug-information-service | 2 | Missing from ServiceAccount |
| external-api-gateway-service | 2 | Missing from ServiceAccount |
| medical-parsing-service | 2 | Missing from ServiceAccount |
| mfa | 2 | Missing from ServiceAccount |
| patient-portal-messaging-service | 2 | Missing from ServiceAccount |
| security-audit-service | 2 | Missing from ServiceAccount |
| sms-service | 6 | Missing from ServiceAccount (called multiple times) |
| threat-detection-service | 2 | Missing from ServiceAccount |
| webhook-management-service | 2 | Missing from ServiceAccount |
| zero-knowledge-auth-service | 2 | Missing from ServiceAccount |

### 2. Security Violation Errors (4 occurrences)
Services that fail SecureDataAccess checks:

| Service | Operation | Reason |
|---------|-----------|---------|
| billing-service | loadBillingCodes | No valid ServiceAccount |
| billing-service | loadPayerConfigurations | No valid ServiceAccount |
| drug-information-service | initialization | No valid ServiceAccount |
| webhook-management-service | initialization | No valid ServiceAccount |

### 3. Failed Operation Errors (2 occurrences)
Operations that fail due to security violations:

| Operation | Service | Error |
|-----------|---------|-------|
| Load billing codes | billing-service | SECURITY: Unauthorized service access attempt |
| Load payer configurations | billing-service | SECURITY: Unauthorized service access attempt |

## Root Cause Analysis

### Database Collection Issue
```javascript
// Current state:
// - ServiceAccount collection: 195 entries (system services)
// - serviceaccounts collection: 16 entries (our newly registered services)
//
// ServiceAccountManager looks in: ServiceAccount (capital S, capital A)
// Our script created in: serviceaccounts (lowercase)
```

### Why This Happened
1. The fix-missing-services.js script created services in wrong collection
2. Mongoose model name mismatch:
   - Expected: `ServiceAccount`
   - Created: `serviceaccounts`
3. ServiceAccountManager queries `ServiceAccount` collection

## Fix Plan

### Fix 1: Migrate Services to Correct Collection
```javascript
// migrate-services-to-correct-collection.js
const mongoose = require('mongoose');

async function migrateServices() {
  await mongoose.connect('mongodb://localhost:27017/intellicare_practice_global');
  const db = mongoose.connection.db;

  // Copy from serviceaccounts to ServiceAccount
  const services = await db.collection('serviceaccounts').find({}).toArray();

  for (const service of services) {
    // Check if doesn't exist in ServiceAccount
    const existing = await db.collection('ServiceAccount').findOne({
      serviceId: service.serviceId
    });

    if (!existing) {
      // Remove _id to avoid conflicts
      delete service._id;
      await db.collection('ServiceAccount').insertOne(service);
      console.log(`✅ Migrated: ${service.serviceId}`);
    }
  }

  // Optionally remove the incorrect collection
  // await db.collection('serviceaccounts').drop();
}
```

### Fix 2: Update Service Registration Script
```javascript
// Correct schema registration
const ServiceAccountSchema = new mongoose.Schema({...}, {
  collection: 'ServiceAccount'  // Force correct collection name
});
```

### Fix 3: Add Missing Permissions
Services need specific permissions for SecureDataAccess:

```javascript
const servicePermissions = {
  'billing-service': {
    collections: ['billing_codes', 'payer_configs', 'invoices', 'payments'],
    operations: ['query', 'insert', 'update'],
    canAccessPHI: true
  },
  'webhook-management-service': {
    collections: ['webhooks', 'webhook_logs'],
    operations: ['query', 'insert', 'update', 'delete']
  },
  'drug-information-service': {
    collections: ['drugs', 'medications', 'drug_interactions'],
    operations: ['query']
  }
};
```

## Implementation Steps

### Step 1: Stop Creating Duplicate Collections
1. Update any service registration scripts to use correct collection name
2. Ensure mongoose schema specifies `collection: 'ServiceAccount'`

### Step 2: Migrate Existing Services
1. Run migration script to copy services to correct collection
2. Verify services exist in ServiceAccount collection
3. Remove serviceaccounts collection if no longer needed

### Step 3: Fix Permissions
1. Update service permissions in ServiceAccount documents
2. Ensure allowedCollections includes required collections
3. Ensure allowedOperations includes required operations

### Step 4: Restart and Verify
1. Restart backend server
2. Check logs for error reduction
3. Verify services authenticate successfully

## Monitoring

### Success Metrics
- Zero "Service not found" errors
- Zero "SECURITY VIOLATION" errors
- All services show "✅ authenticated successfully"

### Log Patterns to Watch
```bash
# Check for authentication success
grep "authenticated successfully" logs/server.log | wc -l

# Check for remaining errors
grep "ERROR:" logs/server.log | grep -v "not found" | wc -l

# Monitor specific service
grep "billing-service" logs/server.log | tail -20
```

## Prevention

### Best Practices
1. Always specify collection name in mongoose schemas
2. Use consistent naming: ServiceAccount (not serviceAccounts or serviceaccounts)
3. Test service registration in dev before production
4. Monitor logs after deployments for new errors

### Validation Script
```javascript
// validate-services.js
async function validateServices() {
  const requiredServices = [
    'billing-service', 'mfa', 'sms-service', // ... etc
  ];

  for (const serviceId of requiredServices) {
    const service = await db.collection('ServiceAccount').findOne({ serviceId });
    if (!service) {
      console.error(`❌ Missing: ${serviceId}`);
    } else {
      console.log(`✅ Found: ${serviceId}`);
    }
  }
}
```

## Quick Fix Script
Run this to fix all issues immediately:

```bash
node migrate-services-fix.js
```

This will:
1. Migrate all services to correct collection
2. Fix permissions
3. Validate everything is working
4. Report results