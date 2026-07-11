# Component Map - Multi-Turn Conversation System

## File Locations

### Core Services
```
apps/backend-api/services/
├── conversationModeManager.js      [NEW]
├── conversationBundles.js          [NEW]
├── conversationSessionManager.js   [NEW]
├── agentServiceClaude.js          [MODIFIED]
├── intentBasedFunctionMapper.js   [MODIFIED]
└── agentServiceV4.js              [NEEDS REVIEW]
```

### Dependencies
- `claudeIntentPatterns.js` - Intent patterns
- `secureDataAccess.js` - Database operations
- `serviceAccountManager.js` - Authentication

## Function Categories (130+ categories)

### Critical Categories for Bundles
1. Patient Management (20+ functions)
2. Appointments (15+ functions)
3. Medical Records (30+ functions)
4. Documents (20+ functions)
5. Insurance/Billing (25+ functions)
6. Provider Management (15+ functions)
7. Lab/Imaging (20+ functions)
8. Prescriptions (15+ functions)

## Integration Points

### Claude Service
- Method: `getCoreFunctions()`
- Line: 3413-3511
- Integration: Mode detection before function selection

### Intent Mapper
- Method: `mapMessageToFunctions()`
- Line: 34-56
- Integration: Check for enhanced session mode

### Session Management
- Global sessions Map
- Cleanup: 30-minute timeout
- Storage: In-memory (needs Redis for production)

## Required Functions Per Bundle

### Minimum Requirements
- Scheduling: 20 functions
- Medical: 30 functions
- Patient: 15 functions
- Document: 20 functions
- Admin: 20 functions
- Collaboration: 15 functions
- Reporting: 15 functions
- General: 10 functions