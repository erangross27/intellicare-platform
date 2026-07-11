# Task 49: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 12202
**Endpoint:** PUT /security-headers

## Current Implementation
```javascript
// Line 12202
return await this.callAPI('/security-headers', 'PUT', args, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
