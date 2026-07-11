# Phase 1: Backend API Tasks

## Overview
Create 3 new API endpoints to support artifact-based document viewing.

**Duration**: 3-4 days
**Tasks**: 8 total

---

## Task 1.1: Create Category List Endpoint ⏱️ 3-4 hours

### Goal
Create endpoint that returns list of available medical data categories for a patient.

### File to Create/Modify
`apps/backend-api/routes/agent.js`

### What to Build
New GET endpoint: `/api/agent/patient/:patientId/categories`

### Expected Response Format
```javascript
{
  success: true,
  categories: [
    {
      name: "medications",
      displayName: "Medications",
      icon: "💊",
      count: 12,
      lastUpdated: "2025-01-20T10:30:00Z"
    },
    {
      name: "lab_results",
      displayName: "Lab Results",
      icon: "🔬",
      count: 45,
      lastUpdated: "2025-01-19T14:20:00Z"
    }
    // ... 30-40 more categories
  ]
}
```

### Logic Required
1. Get patientId from URL params
2. Validate patient exists and user has access (existing middleware)
3. Query ALL 30-40 medical collections for this patient
4. Count documents in each collection
5. Only return categories with count > 0
6. Sort by most recently updated first
7. Return formatted array

### Collections to Query
- medications
- lab_results
- vital_signs
- diagnoses
- allergies
- medical_procedures
- hospital_course
- imaging_reports
- intelligent_recommendations
- clinical_decision_support
- trending_analysis
- quality_metrics
- follow_up_intelligence
- patient_education_context
- medication_optimization
- doctors_medications_recommendations_optimizations
- ... (all medical collections)

### Middleware to Use
- `validateSession`
- `practiceContext`
- `practiceAuth`
- `requireAuth`
- `checkPermission('read:patient_data')`

### Testing
- Test with patient that has data in multiple collections
- Test with patient that has no data
- Test permissions (should fail for unauthorized user)
- Test performance (<200ms response time)

---

## Task 1.2: Create Document List Endpoint ⏱️ 3-4 hours

### Goal
Create endpoint that returns list of documents in a specific category for a patient.

### File to Create/Modify
`apps/backend-api/routes/agent.js`

### What to Build
New GET endpoint: `/api/agent/patient/:patientId/category/:categoryName`

### Expected Response Format
```javascript
{
  success: true,
  category: "medications",
  categoryDisplay: "Medications",
  total: 12,
  documents: [
    {
      _id: "507f1f77bcf86cd799439011",
      date: "2025-01-20T10:30:00Z",
      title: "Current medications",
      preview: "12 active medications including Dupilumab, Fluticasone...",
      isLatest: true
    },
    {
      _id: "507f1f77bcf86cd799439012",
      date: "2025-01-15T09:00:00Z",
      title: "Added Dupilumab",
      preview: "Started biologic therapy for severe asthma...",
      isLatest: false
    }
    // ... more documents, sorted newest first
  ]
}
```

### Logic Required
1. Get patientId and categoryName from URL params
2. Validate patient exists and user has access
3. Validate categoryName is valid medical collection
4. Query the collection for all documents for this patient
5. Sort by date DESC (newest first)
6. Generate preview text (first 100 chars of meaningful data)
7. Mark most recent document with isLatest: true
8. Return formatted array

### Preview Generation Logic
Different for each collection type:
- **medications**: "X active medications including [top 3 names]"
- **lab_results**: "Key findings: [abnormal results], [test count] tests"
- **vital_signs**: "Latest vitals: BP X/X, HR X, Temp X"
- **diagnoses**: "Primary: [main diagnosis], [count] total diagnoses"
- **AI insights**: First 100 chars of recommendations text

### Query Example
```javascript
const collection = categoryName; // e.g., 'medications'
const documents = await SecureDataAccess.query(
  collection,
  { patientId: patientId },
  { sort: { date: -1 }, limit: 100 },
  context
);
```

### Middleware to Use
- Same as Task 1.1

### Testing
- Test with category that has many documents (>10)
- Test with category that has 1 document
- Test with category that has 0 documents
- Test invalid category name (should return error)
- Test performance (<500ms response time)

---

## Task 1.3: Create Document Detail Endpoint ⏱️ 2-3 hours

### Goal
Create endpoint that returns full data for a specific document.

### File to Create/Modify
`apps/backend-api/routes/agent.js`

### What to Build
New GET endpoint: `/api/agent/patient/:patientId/category/:categoryName/document/:documentId`

### Expected Response Format
```javascript
{
  success: true,
  category: "medications",
  document: {
    _id: "507f1f77bcf86cd799439011",
    patientId: "patient123",
    date: "2025-01-20T10:30:00Z",
    data: {
      // Full document structure from MongoDB
      medications: [
        {
          name: "Dupilumab",
          dose: "300mg",
          frequency: "Every 2 weeks",
          // ... full medication data
        }
      ],
      // ... all other fields
    }
  }
}
```

### Logic Required
1. Get patientId, categoryName, and documentId from URL params
2. Validate patient exists and user has access
3. Validate categoryName is valid medical collection
4. Query the specific document by _id
5. Verify document belongs to correct patient (security check)
6. Return full document data

### Security Check
CRITICAL: Verify document.patientId === patientId from URL
If mismatch, return 403 Forbidden (prevents data leakage)

### Query Example
```javascript
const document = await SecureDataAccess.query(
  categoryName,
  {
    _id: new ObjectId(documentId),
    patientId: patientId  // SECURITY: Ensure patient owns document
  },
  {},
  context
);
```

### Middleware to Use
- Same as Task 1.1

### Testing
- Test retrieving valid document
- Test with invalid documentId (should return 404)
- Test with documentId from different patient (should return 403)
- Test performance (<300ms response time)

---

## Task 1.4: Add Document Counting Logic ⏱️ 2 hours

### Goal
Create helper function to efficiently count documents across all collections.

### File to Create
`apps/backend-api/services/documentCountService.js`

### What to Build
Service that counts documents in multiple collections with caching.

### Function Signature
```javascript
class DocumentCountService {
  /**
   * Get document counts for all collections for a patient
   * @param {string} patientId
   * @param {object} context - Security context
   * @returns {Promise<object>} { medications: 12, lab_results: 45, ... }
   */
  async getPatientDocumentCounts(patientId, context) {
    // Implementation
  }
}
```

### Logic Required
1. Define list of all 30-40 medical collections
2. For each collection, count documents where patientId matches
3. Use MongoDB countDocuments() for efficiency
4. Cache results in Redis for 5 minutes
5. Return object with collection names as keys, counts as values

### Optimization: Parallel Queries
```javascript
const counts = await Promise.all(
  collections.map(async (collectionName) => {
    const count = await SecureDataAccess.count(
      collectionName,
      { patientId },
      context
    );
    return { [collectionName]: count };
  })
);
```

### Redis Caching
```javascript
const cacheKey = `patient_doc_counts:${patientId}`;
const cached = await redisService.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... do counting logic ...

await redisService.setex(cacheKey, 300, JSON.stringify(counts)); // 5 min TTL
```

### Testing
- Test with patient with data across many collections
- Test cache hit (should be instant)
- Test cache miss (should complete in <2 seconds)
- Test with patient with no data

---

## Task 1.5: Add Sorting by Date (Newest First) ⏱️ 1 hour

### Goal
Ensure all document list queries sort by date descending.

### File to Modify
Endpoints created in Task 1.2

### What to Add
1. Add date field to all queries
2. Ensure sort: { date: -1 } is applied
3. Handle collections that might not have date field

### Fallback Logic
If collection doesn't have explicit `date` field, use:
- `createdAt` field (if exists)
- `_id` ObjectId timestamp (always exists)

### Sort Logic
```javascript
const sortField = collection.hasDateField ? 'date' : 'createdAt';
const documents = await SecureDataAccess.query(
  collection,
  { patientId },
  { sort: { [sortField]: -1 } },
  context
);
```

### Testing
- Test with collection that has date field
- Test with collection that only has createdAt
- Verify newest documents appear first

---

## Task 1.6: Test Category Endpoint ⏱️ 1 hour

### Goal
Thoroughly test the category list endpoint.

### Test Cases
1. **Success Case**: Patient with data in 10+ categories
   - Should return all categories with counts
   - Should only include categories with count > 0
   - Should be sorted properly

2. **Empty Case**: Patient with no medical data
   - Should return empty array (not error)

3. **Permission Case**: Unauthorized user
   - Should return 403 Forbidden

4. **Performance Case**: Patient with lots of data
   - Should respond in <200ms

5. **Edge Case**: Patient doesn't exist
   - Should return 404 Not Found

### How to Test
Use Postman or curl:
```bash
curl -X GET "http://localhost:5000/api/agent/patient/PATIENT_ID/categories" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Expected Results
- Status: 200 OK
- Response time: <200ms
- Valid JSON with categories array
- All counts accurate

---

## Task 1.7: Test Document List Endpoint ⏱️ 1 hour

### Goal
Thoroughly test the document list endpoint.

### Test Cases
1. **Success Case**: Category with multiple documents
   - Should return sorted list (newest first)
   - Should mark latest document
   - Should include preview text

2. **Single Document**: Category with only 1 document
   - Should return array with 1 item
   - Should mark as isLatest: true

3. **Empty Category**: Valid category, no documents
   - Should return empty array

4. **Invalid Category**: Non-existent collection name
   - Should return 400 Bad Request

5. **Performance**: Category with 100+ documents
   - Should respond in <500ms

### How to Test
```bash
curl -X GET "http://localhost:5000/api/agent/patient/PATIENT_ID/category/medications" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Expected Results
- Status: 200 OK
- Response time: <500ms
- Documents sorted newest first
- Preview text generated

---

## Task 1.8: Test Document Detail Endpoint ⏱️ 1 hour

### Goal
Thoroughly test the document detail endpoint.

### Test Cases
1. **Success Case**: Valid document
   - Should return full document data
   - Should include all fields

2. **Invalid Document ID**: Non-existent ObjectId
   - Should return 404 Not Found

3. **Wrong Patient**: Document belongs to different patient
   - Should return 403 Forbidden (security critical!)

4. **Malformed ID**: Invalid ObjectId format
   - Should return 400 Bad Request

5. **Performance**: Large document
   - Should respond in <300ms

### How to Test
```bash
curl -X GET "http://localhost:5000/api/agent/patient/PATIENT_ID/category/medications/document/DOCUMENT_ID" \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Expected Results
- Status: 200 OK
- Response time: <300ms
- Full document returned
- Security check passed

---

## Completion Checklist

After completing all tasks:
- [ ] All 3 endpoints created
- [ ] DocumentCountService implemented
- [ ] Sorting logic working
- [ ] All tests passing
- [ ] Response times meet targets
- [ ] Security checks in place
- [ ] Error handling complete
- [ ] Ready for frontend integration

---

**Total Time**: 3-4 days
**Dependencies**: None (can start immediately)
**Next Phase**: Frontend Core Components
