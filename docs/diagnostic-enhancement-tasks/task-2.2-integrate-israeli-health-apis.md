# Task 2.2: Integrate Israeli Health System APIs

## Status: Pending
**Estimated Time**: 3-4 days  
**Priority**: High  
**Category**: AI Intelligence Layer  

## Description
Integrate with Israeli health system APIs (כללית, מכבי, מאוחדת, לאומית) to automatically populate patient medical history and validate diagnoses against health fund databases.

## Technical Requirements

### Core Functionality
```javascript
// Extend existing diagnosticServiceNew.js
const healthFundIntegrationFunction = {
  name: "validate_with_health_fund",
  parameters: {
    patientId: String,
    nationalId: String,
    healthFund: String, // מכבי, כללית, מאוחדת, לאומית
    diagnosis: String,
    requestedTreatments: Array
  }
}
```

### Integration Points
- **Existing**: Patient schema already has `healthFund` field in Israeli country schema
- **Existing**: `nationalId` field for patient identification
- **New**: Health fund API integration service
- **Enhance**: Existing diagnostic flow with real-time validation

### API Integration Architecture
```javascript
// New service: healthFundIntegrationService.js
class HealthFundIntegrationService {
  async validatePatientWithHealthFund(nationalId, healthFund) {
    // Integration with health fund APIs
  }
  
  async getPatientMedicalHistory(nationalId, healthFund) {
    // Fetch existing medical records
  }
  
  async validateTreatmentAuthorization(diagnosis, treatments, healthFund) {
    // Check treatment coverage and authorization
  }
}
```

## Implementation Steps

### Phase 1: Health Fund API Research & Setup
1. **API Research** (1 day)
   - Research available APIs for כללית, מכבי, מאוחדת, לאומית
   - Determine authentication methods and data access protocols
   - Map API response formats to existing patient schema

2. **Authentication Setup** (0.5 days)
   - Implement OAuth/API key management for health fund APIs
   - Set up secure credential storage
   - Create API rate limiting and error handling

### Phase 2: Service Integration
3. **Health Fund Integration Service** (1 day)
   - Create `healthFundIntegrationService.js`
   - Implement patient validation against health fund databases
   - Add medical history synchronization capabilities
   - Build Hebrew medical terminology mapping

4. **Diagnostic Service Enhancement** (0.5 days)
   - Extend `diagnosticServiceNew.js` with health fund validation
   - Add real-time treatment authorization checking
   - Integrate with existing Gemini function calling

### Phase 3: Patient Data Synchronization
5. **Medical History Sync** (1 day)
   - Auto-populate patient medical history from health fund records
   - Merge with existing medical history entries in patient schema
   - Handle conflicts and duplicate detection
   - Maintain data integrity and patient privacy

6. **Treatment Authorization** (0.5 days)
   - Real-time checking of treatment coverage
   - Integration with prescription and treatment recommendations
   - Display authorization status in diagnostic interface

## Files to Create/Modify
- `backend/services/healthFundIntegrationService.js` - New service for API integration
- `backend/services/diagnosticServiceNew.js` - Add health fund validation
- `backend/routes/patients.js` - Add health fund sync endpoints
- `backend/models/PatientSchemaFactory.js` - Add health fund sync metadata
- `frontend-vite/src/components/PatientDetail.js` - Display health fund status

## Integration with Existing System
- **Builds on**: Existing `healthFund` field in Israeli patient schema
- **Enhances**: Current patient registration with automatic validation
- **Maintains**: All existing multi-tenant practice architecture
- **Preserves**: Existing security and audit logging systems

## Database Schema Extensions
```javascript
// Add to existing Israeli patient schema
{
  healthFundIntegration: {
    lastSync: Date,
    syncStatus: {
      type: String,
      enum: ['pending', 'synced', 'error', 'partial']
    },
    apiErrors: [String],
    authorizedTreatments: [{
      treatment: String,
      authorized: Boolean,
      authorizationCode: String,
      expiryDate: Date
    }],
    externalRecords: [{
      recordId: String,
      healthFund: String,
      syncedAt: Date,
      recordType: String
    }]
  }
}
```

## Security Considerations
- **HIPAA/Privacy Compliance**: Full encryption of API communications
- **Data Minimization**: Only fetch necessary medical data
- **Audit Logging**: Track all health fund API interactions
- **Patient Consent**: Explicit consent for health fund data access
- **Error Handling**: Graceful degradation when APIs are unavailable

## Success Criteria
- [ ] Seamless patient validation against health fund databases
- [ ] Automatic medical history population from health fund records
- [ ] Real-time treatment authorization checking
- [ ] Hebrew medical terminology correctly mapped and displayed
- [ ] Full integration with existing patient workflow
- [ ] Compliance with Israeli healthcare privacy regulations

## Dependencies
- Health fund API access and documentation
- Legal clearance for healthcare data integration
- Existing patient schema and authentication systems
- Hebrew medical terminology database

## Notes
This integration leverages your existing קופת חולים support to create a comprehensive Israeli healthcare ecosystem integration, significantly enhancing the diagnostic workflow with real healthcare system data.