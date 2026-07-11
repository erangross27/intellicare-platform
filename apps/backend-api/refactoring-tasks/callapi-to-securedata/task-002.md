# Task 2: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 11495
**Endpoint:** GET /security/events

## Current Implementation
```javascript
// Line 11495
return await this.callAPI('/security/events', 'GET', args, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
