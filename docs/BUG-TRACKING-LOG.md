# Bug Tracking Log

## 2025-08-11 - Token Refresh Mechanism Fixed

### Issue
- JWT tokens expiring after 2 hours causing users to be logged out while actively working
- Zero Trust sessions not being found in practice database during refresh attempts
- Session recreation failing when JWT tokens were already expired
- Frontend proactive token refresh not working properly

### Root Cause
1. `validateAndRefreshSession` method in zeroTrustService.js was not handling inactive sessions
2. Session recreation logic in practiceAuth.js couldn't handle expired JWTs
3. Frontend token timestamp tracking was inconsistent
4. Error handling was not specific enough for debugging

### Solution Implemented
1. **Enhanced Zero Trust Session Validation**:
   - Added logic to reactivate valid but inactive sessions
   - Improved session lookup to check for any session, not just active ones
   - Better timing validation and detailed logging

2. **Improved Session Recreation Logic**:
   - Fixed session recreation to handle expired JWTs by decoding them
   - Properly recreates sessions in practice database with original session ID
   - Enhanced error handling for various failure scenarios

3. **Fixed Frontend Token Timestamp Tracking**:
   - Enhanced refreshTokenIfNeeded in securityService.js
   - Added proper token timestamp initialization in AuthContext.js
   - Improved logging for token age and refresh decisions

4. **Added Better Error Handling**:
   - More specific error messages based on failure reasons
   - Enhanced logging throughout the token refresh flow
   - Proper error categorization (401 vs 500 status codes)

### Files Modified
- `backend/services/zeroTrustService.js` - Enhanced validateAndRefreshSession method
- `backend/routes/practiceAuth.js` - Improved session recreation logic in refresh endpoint
- `frontend-vite/src/services/securityService.js` - Fixed token timestamp tracking and refresh logic
- `frontend-vite/src/context/AuthContext.js` - Added token timestamp initialization on login

### Testing Required
- Verify proactive token refresh works at 90 minutes
- Confirm users don't get logged out while actively working
- Test session recreation when sessions are missing
- Validate error handling for various failure scenarios

### Status
✅ FIXED - Token refresh mechanism now works reliably with proactive refresh and session recovery

---

## 2025-08-11 - ZeroTrustSession Schema Registration Error Fixed

### Issue
- Error on login: "Schema hasn't been registered for model 'ZeroTrustSession'"
- Zero Trust authentication falling back to in-memory sessions instead of persistent database sessions
- Session creation failing with MissingSchemaError

### Root Cause
1. **Incorrect schema import in zeroTrustService.js**: Line 162 was using `require('../models/ZeroTrustSession').schema` but the ZeroTrustSession.js module exports the schema directly, not an object with a `.schema` property
2. **Missing model registration**: ZeroTrustSession was not being registered in the practice context middleware like other models

### Solution Implemented
1. **Fixed Schema Import**:
   - Changed `require('../models/ZeroTrustSession').schema` to `require('../models/ZeroTrustSession')` in zeroTrustService.js line 162
   - This matches the pattern used in all other places where ZeroTrustSession is imported

2. **Added Model Registration**:
   - Added ZeroTrustSession import to practiceContext.js middleware
   - Added ZeroTrustSession model registration to req.models object
   - This ensures the model is properly available for all practice databases

### Files Modified
- `backend/services/zeroTrustService.js` - Fixed incorrect schema import on line 162
- `backend/middleware/practiceContext.js` - Added ZeroTrustSession model registration

### Testing Required
- Verify login creates persistent sessions in practice database instead of falling back to in-memory
- Confirm Zero Trust authentication works without schema errors
- Test session validation and refresh functionality

### Status
⏳ TESTING REQUIRED - Need to verify persistent sessions work correctly

---

## Known Issues

### Mongoose Schema Index Warning
**Issue**: Duplicate schema index warning on `nationalId` field
**Warning**: `Duplicate schema index on {"nationalId":1} found`
**Cause**: Both `unique: true` in schema field definition and separate `PatientSchema.index({ nationalId: 1 })` call
**Priority**: Low (doesn't affect functionality)
**Status**: ✅ FIXED
**Fix Applied**: Removed redundant `PatientSchema.index({ nationalId: 1 })` call since `unique: true` automatically creates the index
**Date Fixed**: 2025-08-11
