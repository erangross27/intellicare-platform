# Task 42: Add Authentication Batch 1

## Objective
Implement proper service authentication for all Batch 1 migrated services (118 services)

## Prerequisites
- Task_41 completed (import paths updated)
- ServiceAccountManager configured
- Service registration ready

## Implementation Steps

### 1. Service Authentication Setup
```javascript
// Add to each service constructor
const serviceAccountManager = require('../../shared/services/serviceAccountManager');

class PatientService {
  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('patient-service');
    this.isAuthenticated = true;
  }
}
```

### 2. Patient Management Authentication (28 services)
Services requiring authentication:
- patientService → 'patient-core-service'
- appointmentService → 'appointment-service'
- scheduleService → 'schedule-service'
- waitlistService → 'waitlist-service'
- patientPortalService → 'patient-portal-service'
- [Plus 23 more services]

### 3. Clinical Care Authentication (43 services)
Services requiring authentication:
- diagnosisService → 'diagnosis-service'
- treatmentService → 'treatment-service'
- prescriptionService → 'prescription-service'
- clinicalDecisionService → 'clinical-decision-service'
- careplanService → 'careplan-service'
- [Plus 38 more services]

### 4. Security Services Authentication (25 services)
CRITICAL security services:
- securityService → 'security-core-service'
- auditService → 'audit-service'
- complianceService → 'compliance-service'
- encryptionService → 'encryption-service'
- accessControlService → 'access-control-service'
- [Plus 20 more services]

### 5. Medical Records Authentication (22 services)
Services requiring authentication:
- documentManagementService → 'document-management-service'
- ehrService → 'ehr-service'
- medicalRecordService → 'medical-record-service'
- hl7Service → 'hl7-service'
- fhirService → 'fhir-service'
- [Plus 17 more services]

### 6. Auto-Registration Support
Enable auto-registration for new services:
```javascript
// Services will auto-register on first authentication
try {
  this.serviceToken = await serviceAccountManager.authenticate('service-name');
} catch (error) {
  if (error.message.includes('not found')) {
    // Auto-registration will handle this
    this.serviceToken = await serviceAccountManager.authenticate('service-name');
  }
}
```

### 7. Service Permissions Configuration
Configure permissions for each service:
```javascript
// Example service permissions
const permissions = {
  allowedCollections: ['patients', 'appointments', 'medical_records'],
  allowedOperations: {
    'patients': ['query', 'create', 'update'],
    'appointments': ['query', 'create', 'update', 'delete'],
    'medical_records': ['query', 'create']
  }
};
```

### 8. Authentication Middleware Integration
Update route middleware:
```javascript
// Add service authentication check
router.use('/api/patients', serviceAuth('patient-service'), patientRoutes);
router.use('/api/clinical', serviceAuth('clinical-service'), clinicalRoutes);
```

### 9. Error Handling for Authentication
Implement proper error handling:
```javascript
try {
  await this.serviceToken = serviceAccountManager.authenticate('service-id');
} catch (error) {
  console.error(`Service authentication failed: ${error.message}`);
  throw new Error(`Service ${serviceId} authentication failed`);
}
```

### 10. Authentication Testing
Test authentication for all services:
```bash
# Test authentication
node scripts/test-service-auth-batch1.js

# Verify all services authenticated
node scripts/verify-service-auth.js
```

## Expected Outcomes
- ✅ All 118 services authenticated
- ✅ Service accounts created/verified
- ✅ Permissions configured
- ✅ Error handling implemented
- ✅ Security audit clean

## Validation Steps
1. Service authentication verification
2. Permission testing
3. Access control validation
4. Error scenario testing
5. Security compliance check

## Time Estimate
- Authentication setup: 6 hours
- Permission configuration: 4 hours
- Testing: 4 hours
- Error handling: 2 hours
- Documentation: 2 hours

## Dependencies
- Task_41 (import paths updated)
- ServiceAccountManager ready
- Service registration system active

## Next Task
Task_43_INTEGRATION_TESTING_BATCH_1.md

## Notes for Agent
- CRITICAL: All services must authenticate
- Use auto-registration for efficiency
- Test authentication thoroughly
- Document all service IDs used
- Ensure proper error handling