# Task 56: Update Import Paths Batch 2

## Objective
Update all import paths for Batch 2 migrated services (124 services) to use new Nx workspace structure

## Prerequisites
- Task_55 completed (Batch 2 testing done)
- All Batch 2 services migrated
- Import mapping updated

## Implementation Steps

### 1. Generate Batch 2 Import Mapping
```bash
# Create comprehensive Batch 2 mapping
node scripts/generate-import-map.js batch2
```

### 2. Billing & Insurance Imports (29 services)
```javascript
// OLD IMPORTS
const billingService = require('../services/billingService');
const insuranceService = require('../services/insuranceService');
const stripeService = require('../services/stripeService');

// NEW IMPORTS
const { billingService } = require('@intellicare/billing-insurance/feature-billing-core');
const { insuranceService } = require('@intellicare/billing-insurance/feature-insurance-core');
const { stripeService } = require('@intellicare/billing-insurance/feature-stripe');
```

### 3. AI & Analytics Imports (65 services)
```javascript
// OLD IMPORTS
const agentServiceClaude = require('../services/agentServiceClaude');
const agentServiceV4 = require('../services/agentServiceV4');
const chatService = require('../services/chatService');
const analyticsService = require('../services/analyticsService');

// NEW IMPORTS
const { agentServiceClaude } = require('@intellicare/ai-analytics/feature-claude');
const { agentServiceV4 } = require('@intellicare/ai-analytics/feature-platform-ai');
const { chatService } = require('@intellicare/ai-analytics/feature-chat');
const { analyticsService } = require('@intellicare/ai-analytics/feature-analytics-core');
```

### 4. Infrastructure Imports (20 services)
```javascript
// OLD IMPORTS
const secureDataAccess = require('../services/secureDataAccess');
const encryptionService = require('../services/encryptionService');
const serviceAccountManager = require('../services/serviceAccountManager');
const databaseFactory = require('../services/databaseFactory');

// NEW IMPORTS
const { secureDataAccess } = require('@intellicare/infrastructure/feature-data-access');
const { encryptionService } = require('@intellicare/infrastructure/feature-encryption');
const { serviceAccountManager } = require('@intellicare/infrastructure/feature-service-auth');
const { databaseFactory } = require('@intellicare/infrastructure/feature-database');
```

### 5. Communication Imports (10 services)
```javascript
// OLD IMPORTS
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const notificationService = require('../services/notificationService');

// NEW IMPORTS
const { emailService } = require('@intellicare/communication/feature-email');
const { smsService } = require('@intellicare/communication/feature-sms');
const { notificationService } = require('@intellicare/communication/feature-notifications');
```

### 6. Route File Updates
Update route imports:
```javascript
// routes/billing.js - NEW IMPORTS
const { billingService } = require('@intellicare/billing-insurance/feature-billing-core');
const { invoiceService } = require('@intellicare/billing-insurance/feature-invoicing');

// routes/ai.js - NEW IMPORTS
const { agentServiceWrapper } = require('@intellicare/ai-analytics/feature-orchestration');
const { chatService } = require('@intellicare/ai-analytics/feature-chat');

// routes/admin.js - NEW IMPORTS
const { healthCheckService } = require('@intellicare/infrastructure/feature-health');
const { monitoringService } = require('@intellicare/infrastructure/feature-monitoring');
```

### 7. Server.js Updates
```javascript
// Update server.js for Batch 2 services
const { secureDataAccess } = require('@intellicare/infrastructure/feature-data-access');
const { serviceAccountManager } = require('@intellicare/infrastructure/feature-service-auth');
const { agentServiceWrapper } = require('@intellicare/ai-analytics/feature-orchestration');
const { healthCheckService } = require('@intellicare/infrastructure/feature-health');
```

### 8. Middleware Updates
Update middleware imports:
```javascript
// middleware/auth.js
const { serviceAccountManager } = require('@intellicare/infrastructure/feature-service-auth');
const { encryptionService } = require('@intellicare/infrastructure/feature-encryption');

// middleware/audit.js
const { loggingService } = require('@intellicare/infrastructure/feature-logging');
```

### 9. Automated Import Script Execution
```bash
# Run Batch 2 import updates
node scripts/update-imports-batch2.js

# Verify all imports
node scripts/verify-imports-batch2.js

# Test server startup
npm test:startup
```

### 10. Cross-Reference Validation
```javascript
class ImportValidator {
  async validateBatch2Imports() {
    // Check all route files
    await this.validateRouteImports();
    
    // Check middleware imports
    await this.validateMiddlewareImports();
    
    // Check service cross-references
    await this.validateServiceImports();
    
    // Verify no circular dependencies
    await this.checkCircularDependencies();
  }
}
```

## Expected Outcomes
- ✅ All 124 Batch 2 services have updated imports
- ✅ Server starts successfully
- ✅ No broken references
- ✅ All routes functional
- ✅ Middleware working correctly

## Validation Steps
1. Import syntax validation
2. Server startup testing
3. Route functionality verification
4. Service integration testing
5. Dependency graph validation

## Time Estimate
- Import mapping: 2 hours
- Automated updates: 3 hours
- Manual verification: 4 hours
- Testing: 3 hours
- Issue resolution: 2 hours

## Dependencies
- Task_55 (Batch 2 testing complete)
- All Batch 2 services operational
- Import update scripts ready

## Next Task
Task_57_ADD_AUTHENTICATION_BATCH_2.md

## Notes for Agent
- Focus on critical infrastructure imports
- Test financial service imports carefully
- Verify AI service imports work
- Ensure communication imports function
- Test server startup after each major update