# TASK-011: Implement deleteDocument Function

## Function Details
- **Name**: deleteDocument
- **Category**: Document Management
- **Priority**: Medium
- **Backend Route**: DELETE `/documents/:id` ✅ (Exists)

## Current Implementation
```javascript
async deleteDocument(params, practiceContext) {
  const response = await this.callAPI(`/documents/${params.documentId}`, 'DELETE', {}, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Security & Validation
- Verify user permissions
- Check document ownership
- Audit log deletion
- Confirm destructive action

### 2. Compliance Requirements
- HIPAA deletion requirements
- Retention policy compliance
- Legal hold checks
- Backup management

### 3. Related Data Cleanup
- Remove associated analyses
- Clean up thumbnails
- Update patient records
- Remove from search indexes

## Implementation Code
```javascript
async deleteDocument(params, practiceContext) {
  try {
    // Validate parameters
    if (!params.documentId) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מזהה מסמך נדרש' 
        : 'Document ID is required');
    }
    
    // Get document information first
    const docResponse = await this.callAPI(
      `/documents/${params.documentId}`, 
      'GET', 
      {}, 
      practiceContext
    );
    
    const document = docResponse.data;
    if (!document) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מסמך לא נמצא' 
        : 'Document not found');
    }
    
    // Check permissions
    const hasPermission = await this.checkDeletePermission(document, practiceContext);
    if (!hasPermission.allowed) {
      throw new Error(hasPermission.reason);
    }
    
    // Check retention policy
    const retentionCheck = await this.checkRetentionPolicy(document, practiceContext);
    if (!retentionCheck.canDelete) {
      throw new Error(practiceContext.language === 'he' 
        ? `לא ניתן למחוק מסמך זה: ${retentionCheck.reason}`
        : `Cannot delete document: ${retentionCheck.reason}`);
    }
    
    // Check for legal hold
    const legalHoldCheck = await this.checkLegalHold(document, practiceContext);
    if (legalHoldCheck.isOnHold) {
      throw new Error(practiceContext.language === 'he' 
        ? 'מסמך זה נמצא בהקפאה משפטית ולא ניתן למחקו'
        : 'Document is under legal hold and cannot be deleted');
    }
    
    // Confirm deletion if required
    if (params.requireConfirmation !== false && !params.confirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        document: {
          id: document.id,
          title: document.title || document.fileName,
          type: document.documentType,
          uploadDate: document.uploadDate
        },
        message: practiceContext.language === 'he' 
          ? 'אנא אשר מחיקת המסמך'
          : 'Please confirm document deletion',
        warnings: await this.getDeletionWarnings(document, practiceContext)
      };
    }
    
    // Prepare deletion data
    const deletionData = {\n      documentId: params.documentId,\n      reason: params.reason || 'user_requested',\n      deletedBy: practiceContext.userId,\n      deletionDate: new Date().toISOString(),\n      softDelete: params.softDelete !== false, // Default to soft delete\n      preserveAuditTrail: true\n    };\n    \n    // Perform the deletion\n    const response = await this.callAPI(\n      `/documents/${params.documentId}`, \n      'DELETE', \n      deletionData, \n      practiceContext\n    );\n    \n    // Clean up related data\n    const cleanupResults = await this.performCleanup(document, practiceContext);\n    \n    // Generate audit entry\n    await this.logDeletion(document, deletionData, practiceContext);\n    \n    return {\n      success: true,\n      documentId: params.documentId,\n      deletionType: deletionData.softDelete ? 'soft' : 'hard',\n      message: practiceContext.language === 'he' \n        ? `מסמך \"${document.title || document.fileName}\" נמחק בהצלחה`\n        : `Document \"${document.title || document.fileName}\" deleted successfully`,\n      auditId: response.data.auditId,\n      cleanupResults: cleanupResults,\n      retentionInfo: {\n        canRestore: deletionData.softDelete,\n        purgeDate: this.calculatePurgeDate(document),\n        backupStatus: cleanupResults.backupStatus\n      }\n    };\n    \n  } catch (error) {\n    console.error('Error deleting document:', error);\n    return {\n      success: false,\n      error: error.message,\n      message: practiceContext.language === 'he' \n        ? `שגיאה במחיקת מסמך: ${error.message}`\n        : `Error deleting document: ${error.message}`\n    };\n  }\n}\n\n// Helper function to check delete permissions\nasync checkDeletePermission(document, practiceContext) {\n  const isHebrew = practiceContext.language === 'he';\n  \n  // Check if user is document owner or has admin rights\n  if (document.uploadedBy !== practiceContext.userId && !practiceContext.isAdmin) {\n    return {\n      allowed: false,\n      reason: isHebrew \n        ? 'אין לך הרשאה למחוק מסמך זה'\n        : 'You do not have permission to delete this document'\n    };\n  }\n  \n  // Check if document belongs to current practice\n  if (document.practiceId !== practiceContext.practiceId) {\n    return {\n      allowed: false,\n      reason: isHebrew \n        ? 'מסמך לא שייך למרפאה זו'\n        : 'Document does not belong to this practice'\n    };\n  }\n  \n  // Check if document is referenced elsewhere\n  const references = await this.findDocumentReferences(document.id, practiceContext);\n  if (references.length > 0 && !practiceContext.isAdmin) {\n    return {\n      allowed: false,\n      reason: isHebrew \n        ? 'מסמך מוזכר ברשומות אחרות - נדרשות הרשאות מנהל'\n        : 'Document is referenced in other records - admin privileges required'\n    };\n  }\n  \n  return { allowed: true };\n}\n\n// Helper function to check retention policy\nasync checkRetentionPolicy(document, practiceContext) {\n  const documentAge = new Date() - new Date(document.uploadDate);\n  const ageInYears = documentAge / (1000 * 60 * 60 * 24 * 365);\n  \n  // Get retention requirements for document type\n  const retentionRules = this.getRetentionRules(document.documentType);\n  \n  // Check minimum retention period\n  if (ageInYears < retentionRules.minimumRetentionYears) {\n    return {\n      canDelete: false,\n      reason: practiceContext.language === 'he' \n        ? `נדרש לשמור מסמך זה לפחות ${retentionRules.minimumRetentionYears} שנים`\n        : `Document must be retained for at least ${retentionRules.minimumRetentionYears} years`\n    };\n  }\n  \n  // Check if past maximum retention (should be deleted)\n  if (retentionRules.maximumRetentionYears && ageInYears > retentionRules.maximumRetentionYears) {\n    return {\n      canDelete: true,\n      shouldDelete: true,\n      reason: practiceContext.language === 'he' \n        ? 'מסמך זה עבר את תקופת השמירה המקסימלית'\n        : 'Document has exceeded maximum retention period'\n    };\n  }\n  \n  return { canDelete: true };\n}\n\n// Helper function to perform cleanup\nasync performCleanup(document, practiceContext) {\n  const cleanupResults = {\n    thumbnailDeleted: false,\n    analysisDeleted: false,\n    indexRemoved: false,\n    backupStatus: 'preserved'\n  };\n  \n  try {\n    // Remove thumbnail\n    if (document.thumbnailUrl) {\n      await this.callAPI(\n        `/documents/${document.id}/thumbnail`, \n        'DELETE', \n        {}, \n        practiceContext\n      );\n      cleanupResults.thumbnailDeleted = true;\n    }\n    \n    // Remove analysis data\n    await this.callAPI(\n      `/documents/${document.id}/analysis`, \n      'DELETE', \n      {}, \n      practiceContext\n    );\n    cleanupResults.analysisDeleted = true;\n    \n    // Remove from search index\n    await this.callAPI(\n      `/search/documents/${document.id}`, \n      'DELETE', \n      {}, \n      practiceContext\n    );\n    cleanupResults.indexRemoved = true;\n    \n  } catch (error) {\n    console.warn('Cleanup warning:', error.message);\n  }\n  \n  return cleanupResults;\n}\n\n// Helper function to get retention rules\ngetRetentionRules(documentType) {\n  const rules = {\n    'lab_result': { minimumRetentionYears: 7, maximumRetentionYears: 10 },\n    'imaging': { minimumRetentionYears: 10, maximumRetentionYears: 15 },\n    'prescription': { minimumRetentionYears: 3, maximumRetentionYears: 7 },\n    'vaccination_record': { minimumRetentionYears: 10, maximumRetentionYears: null },\n    'insurance_document': { minimumRetentionYears: 7, maximumRetentionYears: 10 },\n    'consent_form': { minimumRetentionYears: 10, maximumRetentionYears: null },\n    'discharge_summary': { minimumRetentionYears: 10, maximumRetentionYears: 30 },\n    'default': { minimumRetentionYears: 5, maximumRetentionYears: 10 }\n  };\n  \n  return rules[documentType] || rules.default;\n}\n\n// Helper function to calculate purge date\ncalculatePurgeDate(document) {\n  const retentionRules = this.getRetentionRules(document.documentType);\n  const uploadDate = new Date(document.uploadDate);\n  \n  if (retentionRules.maximumRetentionYears) {\n    const purgeDate = new Date(uploadDate);\n    purgeDate.setFullYear(purgeDate.getFullYear() + retentionRules.maximumRetentionYears);\n    return purgeDate.toISOString();\n  }\n  \n  return null; // No automatic purge\n}\n\n// Helper function to log deletion\nasync logDeletion(document, deletionData, practiceContext) {\n  const auditEntry = {\n    action: 'DOCUMENT_DELETED',\n    documentId: document.id,\n    documentTitle: document.title || document.fileName,\n    documentType: document.documentType,\n    patientId: document.patientId,\n    deletedBy: deletionData.deletedBy,\n    deletionDate: deletionData.deletionDate,\n    reason: deletionData.reason,\n    deletionType: deletionData.softDelete ? 'SOFT' : 'HARD',\n    practiceId: practiceContext.practiceId,\n    originalUploadDate: document.uploadDate,\n    fileSize: document.fileSize,\n    checksum: document.checksum // For integrity verification\n  };\n  \n  try {\n    await this.callAPI('/audit/log', 'POST', auditEntry, practiceContext);\n  } catch (error) {\n    console.error('Failed to log deletion:', error);\n  }\n}\n\n// Helper function to get deletion warnings\nasync getDeletionWarnings(document, practiceContext) {\n  const warnings = [];\n  const isHebrew = practiceContext.language === 'he';\n  \n  // Check for recent activity\n  const daysSinceUpload = (new Date() - new Date(document.uploadDate)) / (1000 * 60 * 60 * 24);\n  if (daysSinceUpload < 7) {\n    warnings.push({\n      type: 'recent',\n      message: isHebrew \n        ? 'מסמך זה הועלה לאחרונה (פחות משבוע)'\n        : 'This document was uploaded recently (less than a week ago)'\n    });\n  }\n  \n  // Check if document has been analyzed\n  if (document.hasAnalysis) {\n    warnings.push({\n      type: 'analyzed',\n      message: isHebrew \n        ? 'מסמך זה כולל ניתוח רפואי שיימחק'\n        : 'This document contains medical analysis that will be deleted'\n    });\n  }\n  \n  // Check if document is referenced\n  const references = await this.findDocumentReferences(document.id, practiceContext);\n  if (references.length > 0) {\n    warnings.push({\n      type: 'referenced',\n      message: isHebrew \n        ? `מסמך זה מוזכר ב-${references.length} רשומות אחרות`\n        : `This document is referenced in ${references.length} other records`\n    });\n  }\n  \n  return warnings;\n}\n```\n\n## Testing Checklist\n- [ ] Test successful document deletion\n- [ ] Test permission validation\n- [ ] Test retention policy enforcement\n- [ ] Test legal hold prevention\n- [ ] Test confirmation requirement\n- [ ] Test soft vs hard deletion\n- [ ] Test cleanup operations\n- [ ] Test audit logging\n- [ ] Test Hebrew responses\n- [ ] Test English responses\n\n## Notes\n- Implement legal hold functionality\n- Add bulk deletion capabilities\n- Consider implementing document recovery\n- Add integration with backup systems\n- Implement automated retention policy enforcement