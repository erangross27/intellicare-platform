# E2E Encryption Standardization Plan

## Current State (January 2025)
- **PendingUpload**: Uses Document model's encryption (aes-256-gcm with static key)
- **Document**: Uses its own DocumentEncryption class (aes-256-gcm with static key)
- **E2E Service**: Proper user-based encryption with key derivation

## Problems with Current Approach
1. **Security**: Static encryption keys stored in config (not user-specific)
2. **Inconsistency**: Different services use different encryption methods
3. **Compliance**: Not true end-to-end encryption (server has decryption keys)

## Migration Plan

### Phase 1: Immediate Fix (COMPLETED)
- ✅ Fix analyzeDocument to use Document model's decryption (temporary)
- Documents can now be decrypted and analyzed

### Phase 2: New Uploads Use E2E (TODO)
1. Modify upload flow to use E2E encryption service
2. Store user-specific encrypted documents
3. Add migration flag to distinguish old vs new encryption

### Phase 3: Migrate Existing Data (TODO)
1. Create migration script to:
   - Decrypt existing documents with old method
   - Re-encrypt with E2E service
   - Update database records
2. Run in batches to avoid system overload

### Phase 4: Remove Legacy Encryption (TODO)
1. Remove DocumentEncryption class from Document model
2. Remove encryption methods from PendingUpload model
3. All encryption/decryption through E2E service only

## Implementation Steps

### Step 1: Update PendingUpload Creation
```javascript
// Instead of Document.encryptContent()
const encryptedPackage = await e2eEncryptionService.encryptDocument(userId, fileBuffer);
```

### Step 2: Update Document Creation
```javascript
// Store E2E encrypted data
{
  encryptedContent: encryptedPackage.data,
  contentIv: encryptedPackage.iv,
  contentTag: encryptedPackage.tag,
  encryptionVersion: 'e2e-v1'  // Flag for new encryption
}
```

### Step 3: Update Decryption Logic
```javascript
// Check encryption version
if (doc.encryptionVersion === 'e2e-v1') {
  // Use E2E service
  await e2eEncryptionService.decryptDocument(userId, package);
} else {
  // Legacy decryption (temporary)
  Document.model.decryptContent(content, iv, tag);
}
```

## Benefits
1. **True E2E**: User-specific encryption keys
2. **Compliance**: HIPAA-compliant encryption
3. **Consistency**: Single encryption service for all data
4. **Security**: No static keys in configuration

## Timeline
- Phase 1: ✅ Complete (January 2025)
- Phase 2: 1-2 days
- Phase 3: 2-3 days (depending on data volume)
- Phase 4: 1 day

## Testing Required
1. New upload with E2E encryption
2. Legacy document decryption
3. Migration script on test data
4. Performance testing with E2E