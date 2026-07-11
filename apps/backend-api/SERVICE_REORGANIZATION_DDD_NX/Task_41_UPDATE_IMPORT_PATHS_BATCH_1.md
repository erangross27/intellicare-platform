# Task 41: Update Import Paths Batch 1

## Objective
Update all import paths for Batch 1 migrated services (118 services) to use new Nx workspace structure

## Prerequisites
- Task_40 completed (Batch 1 testing done)
- All services migrated to new locations
- Import mapping ready

## Implementation Steps

### 1. Generate Import Mapping
```bash
# Create comprehensive mapping
node scripts/generate-import-map.js batch1
```

### 2. Patient Management Imports (28 services)
```javascript
// OLD IMPORTS
const patientService = require('../services/patientService');
const appointmentService = require('../services/appointmentService');

// NEW IMPORTS  
const { patientService } = require('@intellicare/patient-management/feature-core');
const { appointmentService } = require('@intellicare/patient-management/feature-scheduling');
```

### 3. Clinical Care Imports (43 services)
```javascript
// OLD IMPORTS
const diagnosisService = require('../services/diagnosisService');
const treatmentService = require('../services/treatmentService');

// NEW IMPORTS
const { diagnosisService } = require('@intellicare/clinical-care/feature-diagnosis');
const { treatmentService } = require('@intellicare/clinical-care/feature-treatment');
```

### 4. Security Services Imports (25 services)
```javascript
// OLD IMPORTS
const securityService = require('../services/securityService');
const auditService = require('../services/auditService');

// NEW IMPORTS
const { securityService } = require('@intellicare/compliance-security/feature-security');
const { auditService } = require('@intellicare/compliance-security/feature-audit');
```

### 5. Medical Records Imports (22 services)
```javascript
// OLD IMPORTS
const documentService = require('../services/documentManagementService');
const ehrService = require('../services/ehrService');

// NEW IMPORTS
const { documentService } = require('@intellicare/medical-records/feature-documents');
const { ehrService } = require('@intellicare/medical-records/feature-ehr');
```

### 6. Update Server Files
Files requiring import updates:
- server.js
- routes/*.js (all route files)
- controllers/*.js
- middleware/*.js
- models/*.js (static methods)

### 7. Update Configuration Files
Configuration import updates:
- nx.json workspace config
- package.json dependencies
- tsconfig.json path mapping
- eslint.config.js rules

### 8. Update Test Files
Test import updates:
- test/*.js files
- __tests__ directories
- jest.config.js
- test utilities

### 9. Automated Import Updates
```bash
# Run automated update script
node scripts/update-imports-batch1.js

# Verify updates
node scripts/verify-imports-batch1.js
```

### 10. Manual Verification
Manual checks required:
- Complex import patterns
- Dynamic imports
- Conditional requires
- External dependencies

## Expected Outcomes
- ✅ All 118 services have updated imports
- ✅ No broken references
- ✅ Server starts successfully
- ✅ All tests pass
- ✅ Build process works

## Validation Steps
1. Import syntax validation
2. Build system test
3. Server startup test
4. Full test suite run
5. Dependency graph verification

## Time Estimate
- Automated updates: 2 hours
- Manual verification: 4 hours
- Testing: 3 hours
- Issue resolution: 2 hours
- Documentation: 1 hour

## Dependencies
- Task_40 (Batch 1 testing)
- Nx workspace configured
- All services in new locations

## Next Task
Task_42_ADD_AUTHENTICATION_BATCH_1.md

## Notes for Agent
- Use automated tools where possible
- Verify all imports manually
- Test after each major update
- Keep backup of original files
- Document any complex patterns found