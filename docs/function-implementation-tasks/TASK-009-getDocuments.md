# TASK-009: Implement getDocuments Function

## Function Details
- **Name**: getDocuments
- **Category**: Document Management
- **Priority**: High
- **Backend Route**: GET `/documents` ✅ (Exists)

## Current Implementation
```javascript
async getDocuments(params, practiceContext) {
  const response = await this.callAPI('/documents', 'GET', params, practiceContext);
  return {
    success: true,
    data: response.data
  };
}
```

## Required Implementation

### 1. Enhanced Query Options
- Filter by patient ID
- Filter by document type
- Filter by date range
- Search by content
- Pagination and sorting

### 2. Document Organization
- Group by category
- Sort by relevance
- Show thumbnails
- Display metadata

### 3. Access Control
- Check user permissions
- Filter by visibility
- Audit access logs
- Handle confidential documents

## Implementation Code
```javascript
async getDocuments(params, practiceContext) {
  try {
    // Build query parameters
    const queryParams = {
      limit: params.limit || 20,
      offset: params.offset || 0,
      sortBy: params.sortBy || 'uploadDate',
      sortOrder: params.sortOrder || 'desc'
    };
    
    // Add filters
    if (params.patientId) {
      queryParams.patientId = params.patientId;
    }
    
    if (params.documentType) {
      queryParams.documentType = params.documentType;
    }
    
    if (params.category) {
      queryParams.category = params.category;
    }
    
    if (params.startDate) {
      queryParams.startDate = new Date(params.startDate).toISOString();
    }
    
    if (params.endDate) {
      queryParams.endDate = new Date(params.endDate).toISOString();
    }
    
    if (params.search || params.keyword) {
      queryParams.search = params.search || params.keyword;
    }
    
    if (params.tags) {
      queryParams.tags = Array.isArray(params.tags) ? params.tags.join(',') : params.tags;
    }
    
    // Fetch documents
    const response = await this.callAPI('/documents', 'GET', queryParams, practiceContext);
    
    const documents = response.data.documents || response.data || [];
    const totalCount = response.data.total || documents.length;
    
    if (!Array.isArray(documents) || documents.length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
        message: practiceContext.language === 'he' 
          ? 'לא נמצאו מסמכים'
          : 'No documents found',
        filters: this.getAvailableFilters([], practiceContext)
      };
    }
    
    // Process documents
    const processedDocuments = documents.map(doc => this.processDocument(doc, practiceContext));
    
    // Group by category if requested
    let result = processedDocuments;
    if (params.groupBy === 'category') {
      result = this.groupDocumentsByCategory(processedDocuments, practiceContext);
    } else if (params.groupBy === 'date') {
      result = this.groupDocumentsByDate(processedDocuments, practiceContext);
    } else if (params.groupBy === 'type') {
      result = this.groupDocumentsByType(processedDocuments, practiceContext);
    }
    
    // Generate statistics
    const stats = this.generateDocumentStats(documents, practiceContext);
    
    return {
      success: true,
      data: result,
      total: totalCount,
      hasMore: (queryParams.offset + queryParams.limit) < totalCount,
      statistics: stats,
      filters: this.getAvailableFilters(documents, practiceContext),
      message: practiceContext.language === 'he' 
        ? `נמצאו ${documents.length} מסמכים`
        : `Found ${documents.length} documents`,
      groupedBy: params.groupBy || 'none'
    };
    
  } catch (error) {
    console.error('Error fetching documents:', error);
    return {
      success: false,
      error: error.message,
      message: practiceContext.language === 'he' 
        ? `שגיאה בטעינת מסמכים: ${error.message}`
        : `Error loading documents: ${error.message}`
    };
  }
}

// Helper function to process individual document
processDocument(doc, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  return {
    id: doc._id || doc.id,
    title: doc.title || doc.fileName,
    fileName: doc.fileName,
    documentType: doc.documentType,
    category: doc.category,
    uploadDate: this.formatDate(doc.uploadDate || doc.createdAt, isHebrew),
    documentDate: doc.documentDate ? this.formatDate(doc.documentDate, isHebrew) : null,
    fileSize: this.formatFileSize(doc.fileSize),
    mimeType: doc.mimeType,
    patientId: doc.patientId,
    patientName: doc.patientName,
    provider: doc.provider,
    facility: doc.facility,
    description: doc.description,
    tags: doc.tags || [],
    isConfidential: doc.isConfidential,
    hasOCR: doc.hasOCRContent,
    hasAnalysis: doc.hasAnalysis,
    thumbnailUrl: doc.thumbnailUrl,
    previewAvailable: this.canPreview(doc.mimeType),
    downloadUrl: `/api/documents/${doc._id || doc.id}/download`,
    summary: this.createDocumentSummary(doc, isHebrew),
    badges: this.createDocumentBadges(doc, isHebrew)
  };
}

// Helper function to group documents by category
groupDocumentsByCategory(documents, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const groups = {};
  
  documents.forEach(doc => {
    const category = doc.category || 'general';
    const categoryName = this.translateCategory(category, isHebrew);
    
    if (!groups[categoryName]) {
      groups[categoryName] = {
        category: category,
        name: categoryName,
        count: 0,
        documents: []
      };
    }
    
    groups[categoryName].documents.push(doc);
    groups[categoryName].count++;
  });
  
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// Helper function to generate document statistics
generateDocumentStats(documents, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  
  const stats = {
    total: documents.length,
    byType: {},
    byCategory: {},
    recentUploads: 0,
    totalSize: 0
  };
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  documents.forEach(doc => {
    // By type
    const type = doc.documentType || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // By category
    const category = doc.category || 'general';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    // Recent uploads
    if (new Date(doc.uploadDate || doc.createdAt) > weekAgo) {
      stats.recentUploads++;
    }
    
    // Total size
    stats.totalSize += doc.fileSize || 0;
  });
  
  // Format totals
  stats.totalSizeFormatted = this.formatFileSize(stats.totalSize);
  stats.averageSize = stats.total > 0 ? Math.round(stats.totalSize / stats.total) : 0;
  stats.averageSizeFormatted = this.formatFileSize(stats.averageSize);
  
  return stats;
}

// Helper function to get available filters
getAvailableFilters(documents, practiceContext) {
  const isHebrew = practiceContext.language === 'he';
  const filters = {
    documentTypes: [],
    categories: [],
    dateRanges: [
      { value: 'week', label: isHebrew ? 'שבוע אחרון' : 'Last Week' },
      { value: 'month', label: isHebrew ? 'חודש אחרון' : 'Last Month' },
      { value: 'year', label: isHebrew ? 'שנה אחרונה' : 'Last Year' }
    ]
  };
  
  if (documents.length > 0) {
    // Extract unique document types
    const types = [...new Set(documents.map(d => d.documentType).filter(Boolean))];
    filters.documentTypes = types.map(type => ({
      value: type,
      label: this.translateDocumentType(type, isHebrew)
    }));
    
    // Extract unique categories
    const categories = [...new Set(documents.map(d => d.category).filter(Boolean))];
    filters.categories = categories.map(category => ({
      value: category,
      label: this.translateCategory(category, isHebrew)
    }));
  }
  
  return filters;
}

// Additional helper functions
canPreview(mimeType) {
  const previewTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'];
  return previewTypes.includes(mimeType);
}

createDocumentSummary(doc, isHebrew) {
  const parts = [];
  
  if (doc.documentType) {
    parts.push(this.translateDocumentType(doc.documentType, isHebrew));
  }
  
  if (doc.provider) {
    parts.push(isHebrew ? `רופא: ${doc.provider}` : `Dr. ${doc.provider}`);
  }
  
  if (doc.documentDate) {
    parts.push(this.formatDate(doc.documentDate, isHebrew));
  }
  
  return parts.join(' | ');
}

createDocumentBadges(doc, isHebrew) {
  const badges = [];
  
  if (doc.isConfidential) {
    badges.push({
      type: 'warning',
      text: isHebrew ? 'חסוי' : 'Confidential'
    });
  }
  
  if (doc.hasOCRContent) {
    badges.push({
      type: 'info',
      text: isHebrew ? 'טקסט מחולץ' : 'OCR Extracted'
    });
  }
  
  if (doc.hasAnalysis) {
    badges.push({
      type: 'success',
      text: isHebrew ? 'מנותח' : 'Analyzed'
    });
  }
  
  return badges;
}

translateCategory(category, isHebrew) {
  const translations = {
    'lab_results': isHebrew ? 'תוצאות מעבדה' : 'Lab Results',
    'imaging': isHebrew ? 'הדמיה' : 'Imaging',
    'prescriptions': isHebrew ? 'מרשמים' : 'Prescriptions',
    'reports': isHebrew ? 'דוחות' : 'Reports',
    'forms': isHebrew ? 'טפסים' : 'Forms',
    'general': isHebrew ? 'כללי' : 'General'
  };
  
  return translations[category] || category;
}
```

## Testing Checklist
- [ ] Test document listing without filters
- [ ] Test filtering by patient ID
- [ ] Test filtering by document type
- [ ] Test date range filtering
- [ ] Test search functionality
- [ ] Test pagination
- [ ] Test sorting options
- [ ] Test grouping by category
- [ ] Test document statistics
- [ ] Test Hebrew responses
- [ ] Test English responses

## Notes
- Add full-text search capabilities
- Implement document preview functionality
- Add bulk document operations
- Consider adding document sharing features