# Automatic Medical Collection Permissions System

## Overview
The system automatically grants `read:collection_name` and `write:collection_name` permissions to admin users whenever new medical data is stored in a collection.

## How It Works

### 1. **Data Storage Trigger**
Whenever medical data is saved through `medicalDataService.storeMedicalData()`:
- **File**: `services/medicalDataService.js` (line 1001-1005)
- **Both paths use this**: 
  - Manual data entry via API
  - Batch PDF document processing

### 2. **Permission Sync Service**
- **File**: `services/permissionSyncService.js`
- **What it does**:
  - Finds all admin users (role: 'admin' or permissions include 'system_admin')
  - Grants `read:collection_name` and `write:collection_name` to each admin
  - Runs asynchronously (non-blocking, won't slow down data storage)
  - Caches known collections to avoid duplicate grants

### 3. **User Permissions Required**
- **Read Access**: `read:collection_name` - Allows viewing data via `/api/medical/collection-name/:patientId`
- **Write Access**: `write:collection_name` - Allows manually adding/editing data

### 4. **Service Account Access**
- **Service**: `permission-sync` is whitelisted in SecureDataAccess (line 838)
- **Location**: `services/secureDataAccess.js`

## Example Flow

1. **PDF Uploaded** → Batch processor extracts "providers" data
2. **Data Saved** → `medicalDataService.storeMedicalData('providers', data, context)`
3. **Auto Permission Grant** → `permissionSyncService.ensureCollectionPermissions('providers', context)`
4. **Result**: All admins get `read:providers` and `write:providers`

## One-Time Sync for Existing Collections

Run this to grant permissions for all 719 existing medical collections:

```bash
node scripts/syncAllMedicalPermissions.js
```

This grants 1,438 permissions total (719 collections × 2 permissions).

## Security Notes

- ✅ Only admin users get automatic permissions
- ✅ Service account `permission-sync` is whitelisted for secure database access
- ✅ Non-blocking operation - won't slow down data storage
- ✅ Cache prevents duplicate permission grants
- ✅ Best-effort - permission failures won't block medical data storage

## Future Considerations

When new medical collections are added:
1. Add to `medicalCollectionsService.js`
2. Create handler in `agentServiceV4.saveExtractedDocumentData()`
3. Permissions will be **automatically granted** when first data is stored
4. No manual permission management needed! 🎉
