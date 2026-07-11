# 🔧 AGENT 6 COMPLETION TASKS - SECURITY VIOLATIONS

## STATUS: PARTIALLY COMPLETE (133 violations remain)

Agent 6 reduced violations from 139 to 133 but left critical violations unfixed in key service files.

## REMAINING CRITICAL VIOLATIONS TO FIX

### 1. zeroTrustService.js - 11 violations remaining
**File**: `backend/services/zeroTrustService.js`
**Current Status**: PARTIAL migration to SecureDataAccess

**Tasks**:
- Complete migration of all .find() calls to SecureDataAccess.query()
- Replace all .findOne() calls with SecureDataAccess.queryOne()
- Replace all .save() calls with SecureDataAccess.update()
- Add proper context definitions for all operations
- Fix remaining process.env usage

### 2. agentServiceExtended.js - 7 violations
**File**: `backend/services/agentServiceExtended.js` 
**Issue**: AI service needs security wrapper

**Tasks**:
- Wrap with aiSecurityWrapper service
- Replace direct database access with SecureDataAccess
- Add service authentication via serviceAccountManager
- Implement function filtering and constraints

### 3. keyManagementService.js - 6 violations
**File**: `backend/services/keyManagementService.js`
**Issue**: Security service with violations (investigate)

**Tasks**:
- Review violations (may be false positives for key management)
- Secure any actual violations found
- Ensure encryption keys use SecureConfigService
- Add audit logging for key operations

### 4. routes/medicalData.js - 5 violations remaining
**File**: `backend/routes/medicalData.js`
**Current Status**: PARTIAL migration (was 12, now 5)

**Tasks**:
- Complete remaining .find() to SecureDataAccess.query() migrations
- Fix remaining schema instantiations
- Add context to all remaining database operations
- Test route functionality after changes

### 5. delete-all-documents.js - 5 violations
**File**: `backend/delete-all-documents.js`
**Issue**: Admin script with violations

**Tasks**:
- This is an admin script - violations may be acceptable
- Review if script is needed for production
- If needed, secure with proper authentication
- If not needed, move to admin-tools directory

## ADDITIONAL VIOLATION CLEANUP

### Service Files Needing Attention
Based on Agent 6's report, these files need final cleanup:

1. **services/agentService*.js files**
   - Multiple AI service files may have violations
   - Need security wrapper implementation
   - Service authentication requirements

2. **Route files**
   - Complete SecureDataAccess migration
   - Add proper error handling
   - Context validation for all operations

3. **Script files**
   - Review which scripts are production vs admin
   - Secure production scripts
   - Document admin script usage

## VIOLATION FIXING STRATEGY

### Pattern Replacements Needed:
```javascript
// ❌ BEFORE (Violation)
Model.find({ filter })
Model.findOne({ id })
await document.save()
process.env.SECRET_KEY
require('mongoose').connection

// ✅ AFTER (Secure)
SecureDataAccess.query('collection', { filter }, options, context)
SecureDataAccess.queryOne('collection', { id }, context)
SecureDataAccess.update('collection', filter, update, context)
SecureConfigService.get('SECRET_KEY')
// Remove direct mongoose usage
```

### Context Definition Template:
```javascript
const context = {
  serviceId: 'service-name',
  userId: req.user?.id,
  practiceId: req.practice?.id,
  action: 'OPERATION_NAME',
  requestId: req.requestId
};
```

## VERIFICATION COMMANDS

```bash
# Check current violation count
cd backend
node check-violations.js

# Focus on specific files
node check-violations.js services/zeroTrustService.js
node check-violations.js services/agentServiceExtended.js
node check-violations.js routes/medicalData.js

# Target: Reduce to under 100 violations
```

## SUCCESS CRITERIA

- ✅ **zeroTrustService.js**: 0 violations (from 11)
- ✅ **agentServiceExtended.js**: 0 violations (from 7)  
- ✅ **keyManagementService.js**: Review complete, violations justified or fixed
- ✅ **routes/medicalData.js**: 0 violations (from 5)
- ✅ **Total violations**: Under 100 (from 133)
- ✅ **All service files**: Use SecureDataAccess exclusively
- ✅ **All route files**: Proper context validation

## COMMANDS TO START

```bash
cd backend

# Check current state
node check-violations.js | grep -E "(zeroTrustService|agentServiceExtended|keyManagementService|medicalData)"

# Start fixing the highest priority file
cp services/zeroTrustService.js services/zeroTrustService.js.backup
# Then fix violations in zeroTrustService.js

# Verify syntax after changes  
node -c services/zeroTrustService.js

# Re-check violations
node check-violations.js services/zeroTrustService.js
```

## DEADLINE

Complete remaining security violation fixes to get under 100 total violations with all critical service files clean.