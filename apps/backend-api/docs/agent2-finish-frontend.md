# Agent 2: Complete Frontend Security Migration

## Analysis Results
I've analyzed the remaining violations. Here's what needs to be done:

### Files to DELETE (Test/Backup - Not Production):
```bash
# Delete these backup/old files - they're not used in production:
rm -rf frontend-vite/src/components/chat-old-backup/
rm frontend-vite/src/components/ChatAuth-OLD.js
rm frontend-vite/src/test-frontend-security.js
```

### Files to MIGRATE (22 Production Files):
These files are actively used and need `secureApiClient` migration:

#### Priority 1: Core Components (6 files)
1. `frontend-vite/src/services/api.js` - Main API service
2. `frontend-vite/src/chat-new/ChatContainer.js` - Active chat component
3. `frontend-vite/src/components/chat/components/SessionManager.js` - Session management
4. `frontend-vite/src/components/NewVisit.js` - Patient visits
5. `frontend-vite/src/components/PatientHistoryView.js` - Medical history
6. `frontend-vite/src/components/MedicalHistoryModal.js` - History modal

#### Priority 2: Viewers & Tools (7 files)
7. `frontend-vite/src/components/viewers/DocumentViewer.js`
8. `frontend-vite/src/components/viewers/DocumentViewerSimple.js`
9. `frontend-vite/src/components/viewers/LabResultsViewer.js`
10. `frontend-vite/src/components/viewers/MedicationTracker.js`
11. `frontend-vite/src/components/VoiceInterface.js`
12. `frontend-vite/src/components/SmartCitySelector.js`
13. `frontend-vite/src/components/UserSettings.js`

#### Priority 3: Security & Utilities (9 files)
14. `frontend-vite/src/services/securityService.js` - Security service itself!
15. `frontend-vite/src/components/SecurityMonitor.js` - Security dashboard
16. `frontend-vite/src/utils/enhancedSessionManager.js`
17. `frontend-vite/src/utils/secureStorage.js`
18. `frontend-vite/src/utils/secureStorageV2.js`
19. `frontend-vite/src/components/ChatInterfaceDark.js`
20. `frontend-vite/src/components/ChatInterfaceUnified.js`
21. `frontend-vite/src/config/languages.js`
22. `frontend-vite/src/services/api.js` (if not already done)

## Instructions for Agent 2:

### Step 1: Clean Up Backups
```bash
# Run these commands to remove backup/test files:
cd frontend-vite/src
rm -rf components/chat-old-backup/
rm components/ChatAuth-OLD.js
rm test-frontend-security.js
```

### Step 2: Migrate Each File
For each of the 22 production files listed above:

1. **Import secureApiClient at the top:**
```javascript
import { secureApiClient } from '../services/secureApiClient';
// or appropriate relative path
```

2. **Replace ALL fetch() calls:**

**OLD:**
```javascript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data)
});
```

**NEW:**
```javascript
const response = await secureApiClient.post('/api/endpoint', data);
```

3. **Handle different HTTP methods:**
- `fetch(url)` → `secureApiClient.get(url)`
- `fetch(url, {method: 'POST', body})` → `secureApiClient.post(url, body)`
- `fetch(url, {method: 'PUT', body})` → `secureApiClient.put(url, body)`
- `fetch(url, {method: 'DELETE'})` → `secureApiClient.delete(url)`

### Step 3: Test Each Migration
After migrating each file, test that component:
```bash
# Verify no fetch() remains in production files:
grep -r "fetch(" frontend-vite/src --include="*.js" --include="*.jsx" | grep -v "secureApiClient\|backup\|old\|test"
# Should return ZERO results
```

### Step 4: Create Verification Report
Create `frontend-vite/FRONTEND-SECURITY-COMPLETE.md` with:
```markdown
# Frontend Security Migration Complete

## Files Deleted (5 files):
- [x] components/chat-old-backup/ (3 files)
- [x] components/ChatAuth-OLD.js
- [x] test-frontend-security.js

## Files Migrated (22 files):
- [x] services/api.js - X fetch calls replaced
- [x] chat-new/ChatContainer.js - X fetch calls replaced
[... list all 22 with counts]

## Verification:
Total fetch() calls before: 38
Total fetch() calls after: 0
Total secureApiClient calls: 38

## Test Results:
[Include test output showing all components work]
```

## Expected Time: 2-3 hours
Each file migration should take 5-10 minutes. Focus on accuracy over speed.

## Success Criteria:
```bash
# This command should return 0:
grep -r "fetch(" frontend-vite/src --include="*.js" --include="*.jsx" | grep -v "secureApiClient\|backup\|old\|test" | wc -l
```

When you're done, the frontend will be 100% secured with signed requests!