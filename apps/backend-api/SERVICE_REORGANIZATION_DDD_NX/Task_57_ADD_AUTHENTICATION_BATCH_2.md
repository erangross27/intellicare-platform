# Task 57: Add Authentication Batch 2

## Objective
Implement proper service authentication for all Batch 2 migrated services (124 services)

## Prerequisites
- Task_56 completed (import paths updated)
- ServiceAccountManager available from infrastructure
- Auto-registration active

## Implementation Steps

### 1. Service Authentication Framework
```javascript
// Enhanced authentication for Batch 2
const { serviceAccountManager } = require('@intellicare/infrastructure/feature-service-auth');

class ServiceAuthenticator {
  async authenticateService(serviceId) {
    try {
      const token = await serviceAccountManager.authenticate(serviceId);
      return token;
    } catch (error) {
      console.error(`Authentication failed for ${serviceId}: ${error.message}`);
      throw error;
    }
  }
}
```

### 2. Billing & Insurance Authentication (29 services)
CRITICAL financial service authentication:
```javascript
// Enhanced security for financial services
class BillingServiceAuth {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('billing-service');
    this.permissions = await this.validateFinancialPermissions();
  }

  async validateFinancialPermissions() {
    return {
      allowedCollections: ['billing', 'invoices', 'payments', 'insurance_claims'],
      restrictedOperations: ['delete'], // Financial data rarely deleted
      auditRequired: true,
      encryptionRequired: true
    };
  }
}
```

### 3. AI & Analytics Authentication (65 services)
```javascript
class AIServiceAuth {
  async initialize() {
    // Claude service authentication
    this.claudeToken = await serviceAccountManager.authenticate('claude-service');
    
    // Platform AI authentication
    this.platformAIToken = await serviceAccountManager.authenticate('platform-ai-service');
    
    // Analytics authentication
    this.analyticsToken = await serviceAccountManager.authenticate('analytics-service');
    
    // Chat service authentication
    this.chatToken = await serviceAccountManager.authenticate('chat-service');
  }
}
```

### 4. Infrastructure Authentication (20 services)
CRITICAL system authentication:
```javascript
class InfrastructureAuth {
  async initialize() {
    // SecureDataAccess authentication (highest privileges)
    this.dataAccessToken = await serviceAccountManager.authenticate('secure-data-access');
    
    // Encryption service authentication
    this.encryptionToken = await serviceAccountManager.authenticate('encryption-service');
    
    // Service account manager self-authentication
    this.serviceAuthToken = await serviceAccountManager.authenticate('service-account-manager');
  }
}
```

### 5. Communication Authentication (10 services)
```javascript
class CommunicationAuth {
  async initialize() {
    // Email service authentication
    this.emailToken = await serviceAccountManager.authenticate('email-service');
    
    // SMS service authentication  
    this.smsToken = await serviceAccountManager.authenticate('sms-service');
    
    // Notification service authentication
    this.notificationToken = await serviceAccountManager.authenticate('notification-service');
  }
}
```

### 6. Service Permission Configuration
Configure detailed permissions:
```javascript
const servicePermissions = {
  'billing-service': {
    allowedCollections: ['billing', 'invoices', 'payments'],
    allowedOperations: ['query', 'create', 'update'],
    restrictedOperations: ['delete'],
    auditRequired: true,
    encryptionLevel: 'financial'
  },
  'claude-service': {
    allowedCollections: ['chat_sessions', 'chat_messages'],
    allowedOperations: ['query', 'create', 'update'],
    rateLimit: 1000, // requests per minute
    auditRequired: true
  },
  'secure-data-access': {
    allowedCollections: ['*'],
    allowedOperations: ['*'],
    systemService: true,
    auditRequired: true
  }
};
```

### 7. Auto-Registration Enhancement
```javascript
class EnhancedAutoRegistration {
  async registerBatch2Services() {
    const batch2Services = [
      // Billing services
      'billing-service', 'invoice-service', 'payment-service',
      // AI services
      'claude-service', 'platform-ai-service', 'chat-service',
      // Infrastructure services
      'encryption-service', 'health-check-service',
      // Communication services
      'email-service', 'sms-service', 'notification-service'
    ];

    for (const serviceId of batch2Services) {
      try {
        await serviceAccountManager.authenticate(serviceId);
        console.log(`✅ ${serviceId} authenticated successfully`);
      } catch (error) {
        console.error(`❌ ${serviceId} authentication failed: ${error.message}`);
      }
    }
  }
}
```

### 8. Route Authentication Middleware
```javascript
// Enhanced route protection
const serviceAuth = (requiredService) => {
  return async (req, res, next) => {
    try {
      const serviceToken = req.headers['x-service-token'];
      const isValid = await serviceAccountManager.validateToken(serviceToken, requiredService);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Service authentication required' });
      }
      
      req.serviceId = requiredService;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  };
};

// Apply to routes
router.use('/api/billing', serviceAuth('billing-service'), billingRoutes);
router.use('/api/ai', serviceAuth('claude-service'), aiRoutes);
```

### 9. Service Health Integration
```javascript
class ServiceHealthAuth {
  async checkAuthenticatedServices() {
    const services = await serviceAccountManager.listAuthenticatedServices();
    
    for (const service of services) {
      const health = await this.checkServiceHealth(service.serviceId);
      if (!health.authenticated) {
        await this.reAuthenticateService(service.serviceId);
      }
    }
  }
}
```

### 10. Authentication Monitoring
```javascript
class AuthenticationMonitor {
  async monitorBatch2Authentication() {
    // Monitor authentication failures
    await this.monitorAuthFailures();
    
    // Track token usage
    await this.trackTokenUsage();
    
    // Alert on suspicious activity
    await this.alertOnSuspiciousActivity();
    
    // Generate authentication reports
    await this.generateAuthReports();
  }
}
```

## Expected Outcomes
- ✅ All 124 Batch 2 services authenticated
- ✅ Financial services have enhanced security
- ✅ AI services properly authenticated
- ✅ Infrastructure services secured
- ✅ Communication services authenticated

## Validation Steps
1. Service authentication verification
2. Permission testing
3. Route protection validation
4. Auto-registration testing
5. Authentication monitoring setup

## Time Estimate
- Authentication setup: 8 hours
- Permission configuration: 4 hours
- Route middleware updates: 3 hours
- Testing: 4 hours
- Monitoring setup: 2 hours

## Dependencies
- Task_56 (import paths updated)
- ServiceAccountManager operational
- Auto-registration system active

## Next Task
Task_58_INTEGRATION_TESTING_BATCH_2.md

## Notes for Agent
- CRITICAL: Financial services need enhanced security
- Test all AI service authentication
- Verify infrastructure service access
- Ensure communication services work
- Monitor authentication continuously