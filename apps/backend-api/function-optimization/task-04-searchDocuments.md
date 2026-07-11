# Task 04: Optimize searchDocuments Function

## Current Issue
- Returns FULL document content including base64 data
- Includes entire OCR text, analysis results
- Single document can be 10,000+ tokens

## Location
- File: `services/agentServiceV4.js`
- Multiple instances (lines: ~15588, ~25480, ~31238)
- Critical for document management

## Current Return Structure
```javascript
{
  success: true,
  data: [{
    _id, title, content, /* Full base64 data */,
    ocrText, /* Entire extracted text */,
    analysisResult, /* Full AI analysis */,
    metadata, tags, ...
  }]
}
```

## Required Optimization
Return document metadata only:
```javascript
{
  _id: doc._id,
  title: doc.title,
  type: doc.documentType,
  date: doc.uploadDate,
  size: doc.fileSize,
  snippet: /* First 100 chars of content */,
  hasAnalysis: !!doc.analysisResult
}
```

## Implementation Steps
1. Never return base64 data in lists
2. Truncate text content to snippets
3. Return metadata and flags only
4. Add separate "getDocumentContent" for full access

## Expected Result
- Token reduction: 99% (from 10,000+ to <100 per doc)
- Prevents base64 transmission to Claude
- Maintains search functionality