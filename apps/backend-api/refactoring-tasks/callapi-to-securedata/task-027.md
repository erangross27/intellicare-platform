# Task 27: Refactor callAPI to SecureDataAccess

**Status:** ❌ Not Started
**File:** agentServiceV4.js
**Line:** 12066
**Endpoint:** GET /threat-detection/check/${args.ipAddress}

## Current Implementation
```javascript
// Line 12066
return await this.callAPI(`/threat-detection/check/${args.ipAddress}`, 'GET', {}, practiceContext);
```

## Analysis Needed
- [ ] Determine if this is a database operation or infrastructure service
- [ ] If database: Identify collection(s) and refactor to SecureDataAccess
- [ ] If infrastructure: Mark as "INFRASTRUCTURE" and keep as callAPI
- [ ] If external service: Mark as "EXTERNAL SERVICE" and keep as callAPI

## Notes
<!-- Add implementation notes here -->
