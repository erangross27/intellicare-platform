# Task 174: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 41177
**Endpoint:** POST /diagnosis/differential

## Current Implementation
```javascript
// Line 41177
const result = await this.callAPI('/diagnosis/differential', 'POST', diagnosisData, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
