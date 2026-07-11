# Task 179: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 41433
**Endpoint:** GET /providers

## Current Implementation
```javascript
// Line 41433
const result = await this.callAPI('/providers', 'GET', params, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
