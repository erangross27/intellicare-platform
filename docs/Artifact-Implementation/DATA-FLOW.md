# Data Flow Reference

## API Endpoints

### 1. Get Available Categories

**Endpoint**: `GET /api/agent/patient/:patientId/categories`

**Purpose**: Get list of medical data categories available for a patient

**Request**:
```http
GET /api/agent/patient/patient123/categories HTTP/1.1
Host: intellicare.health
Cookie: session=<session_cookie>
```

**Response**:
```json
{
  "success": true,
  "patientId": "patient123",
  "categories": [
    {
      "name": "medications",
      "displayName": "Medications",
      "icon": "💊",
      "count": 12,
      "lastUpdated": "2025-01-20T10:30:00Z"
    },
    {
      "name": "lab_results",
      "displayName": "Lab Results",
      "icon": "🔬",
      "count": 45,
      "lastUpdated": "2025-01-19T14:20:00Z"
    },
    {
      "name": "vital_signs",
      "displayName": "Vital Signs",
      "icon": "📊",
      "count": 120,
      "lastUpdated": "2025-01-20T08:15:00Z"
    }
    // ... more categories
  ],
  "total": 15
}
```

**Implementation**:
```javascript
// routes/agent.js
router.get('/patient/:patientId/categories',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const context = {
        serviceId: 'artifact-service',
        operation: 'get_categories',
        practiceId: req.practice.id
      };

      // Get counts for all collections
      const counts = await documentCountService.getPatientDocumentCounts(
        patientId,
        context
      );

      // Build category array (only include if count > 0)
      const categories = Object.entries(counts)
        .filter(([name, count]) => count > 0)
        .map(([name, count]) => {
          const metadata = getMetadataForCollection(name);
          return {
            name,
            displayName: metadata.displayName,
            icon: metadata.icon,
            count,
            lastUpdated: null  // TODO: Get from collection
          };
        })
        .sort((a, b) => b.count - a.count);  // Sort by count desc

      res.json({
        success: true,
        patientId,
        categories,
        total: categories.length
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

---

### 2. Get Documents in Category

**Endpoint**: `GET /api/agent/patient/:patientId/category/:categoryName`

**Purpose**: Get list of documents in a specific category for a patient

**Request**:
```http
GET /api/agent/patient/patient123/category/medications HTTP/1.1
Host: intellicare.health
Cookie: session=<session_cookie>
```

**Response**:
```json
{
  "success": true,
  "patientId": "patient123",
  "category": "medications",
  "categoryDisplay": "Medications",
  "total": 12,
  "documents": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "date": "2025-01-20T10:30:00Z",
      "title": "Current medications",
      "preview": "12 active medications including Dupilumab, Fluticasone, Montelukast...",
      "isLatest": true
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "date": "2025-01-15T09:00:00Z",
      "title": "Added Dupilumab",
      "preview": "Started biologic therapy for severe asthma. Dupilumab 300mg SQ Q2wks...",
      "isLatest": false
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "date": "2024-12-10T14:30:00Z",
      "title": "Medication changes",
      "preview": "Adjusted inhaler dosage: Fluticasone/Salmeterol 250/50 to 500/50...",
      "isLatest": false
    }
    // ... more documents, sorted by date desc
  ]
}
```

**Implementation**:
```javascript
// routes/agent.js
router.get('/patient/:patientId/category/:categoryName',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId, categoryName } = req.params;
      const context = {
        serviceId: 'artifact-service',
        operation: 'get_documents',
        practiceId: req.practice.id
      };

      // Validate category exists
      if (!isValidMedicalCollection(categoryName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${categoryName}`
        });
      }

      // Query documents
      const documents = await SecureDataAccess.query(
        categoryName,
        { patientId },
        {
          sort: { date: -1 },  // Newest first
          limit: 100,
          projection: { _id: 1, date: 1, data: 1 }  // Limit fields
        },
        context
      );

      // Format response
      const formattedDocs = documents.map((doc, index) => ({
        _id: doc._id.toString(),
        date: doc.date,
        title: generateDocumentTitle(doc, categoryName),
        preview: generateDocumentPreview(doc, categoryName),
        isLatest: index === 0  // First doc is latest
      }));

      const metadata = getMetadataForCollection(categoryName);

      res.json({
        success: true,
        patientId,
        category: categoryName,
        categoryDisplay: metadata.displayName,
        total: formattedDocs.length,
        documents: formattedDocs
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

---

### 3. Get Document Detail

**Endpoint**: `GET /api/agent/patient/:patientId/category/:categoryName/document/:documentId`

**Purpose**: Get full data for a specific document

**Request**:
```http
GET /api/agent/patient/patient123/category/medications/document/507f1f77bcf86cd799439011 HTTP/1.1
Host: intellicare.health
Cookie: session=<session_cookie>
```

**Response**:
```json
{
  "success": true,
  "patientId": "patient123",
  "category": "medications",
  "document": {
    "_id": "507f1f77bcf86cd799439011",
    "patientId": "patient123",
    "date": "2025-01-20T10:30:00Z",
    "source": "batch_document_extraction",
    "data": {
      "medications": [
        {
          "name": "Dupilumab",
          "genericName": "dupilumab",
          "brandName": "Dupixent",
          "dose": "300mg",
          "route": "subcutaneous",
          "frequency": "Every 2 weeks",
          "startDate": "2025-01-15",
          "indication": "Severe persistent asthma",
          "prescriber": "Dr. Cohen",
          "status": "active",
          "notes": "Patient tolerating well. Significant improvement in symptoms.",
          "response": "Excellent - exacerbations reduced by 70%",
          "sideEffects": [],
          "interactions": []
        },
        {
          "name": "Fluticasone/Salmeterol",
          "genericName": "fluticasone/salmeterol",
          "brandName": "Advair Diskus",
          "dose": "500/50 mcg",
          "route": "inhalation",
          "frequency": "Twice daily",
          "startDate": "2020-03-10",
          "indication": "Asthma maintenance",
          "prescriber": "Dr. Cohen",
          "status": "active",
          "notes": "Long-term controller medication",
          "response": "Good control",
          "sideEffects": ["Hoarseness (mild)"],
          "interactions": []
        }
        // ... all medications
      ]
    }
  }
}
```

**Implementation**:
```javascript
// routes/agent.js
router.get('/patient/:patientId/category/:categoryName/document/:documentId',
  generalRateLimit,
  validateSession,
  practiceContext,
  practiceAuth,
  requireAuth,
  checkPermission('read:patient_data'),
  async (req, res) => {
    try {
      const { patientId, categoryName, documentId } = req.params;
      const context = {
        serviceId: 'artifact-service',
        operation: 'get_document',
        practiceId: req.practice.id
      };

      // Validate category
      if (!isValidMedicalCollection(categoryName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: ${categoryName}`
        });
      }

      // Query specific document
      const documents = await SecureDataAccess.query(
        categoryName,
        {
          _id: new ObjectId(documentId),
          patientId: patientId  // CRITICAL: Security check
        },
        {},
        context
      );

      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      const document = documents[0];

      // Verify patient ownership (extra security)
      if (document.patientId !== patientId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        patientId,
        category: categoryName,
        document: {
          _id: document._id.toString(),
          patientId: document.patientId,
          date: document.date,
          source: document.source,
          data: document  // Full document data
        }
      });
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

---

## Helper Functions

### Generate Document Title
```javascript
function generateDocumentTitle(document, categoryName) {
  // Category-specific title generation
  switch (categoryName) {
    case 'medications':
      const medCount = document.medications?.length || 0;
      return medCount === 1 ? 'Medication change' : `Current medications (${medCount})`;

    case 'lab_results':
      const testCount = document.results?.reduce((sum, cat) => sum + cat.tests.length, 0) || 0;
      return `Lab results (${testCount} tests)`;

    case 'vital_signs':
      return 'Vital signs';

    case 'diagnoses':
      return 'Diagnosis list';

    default:
      return categoryName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}
```

### Generate Document Preview
```javascript
function generateDocumentPreview(document, categoryName) {
  // Category-specific preview text (first ~100 chars of meaningful data)
  switch (categoryName) {
    case 'medications':
      const meds = document.medications || [];
      const activeMeds = meds.filter(m => m.status === 'active');
      const medNames = activeMeds.slice(0, 3).map(m => m.name).join(', ');
      const more = activeMeds.length > 3 ? `and ${activeMeds.length - 3} more` : '';
      return `${activeMeds.length} active medications including ${medNames} ${more}`.trim();

    case 'lab_results':
      const abnormal = findAbnormalResults(document);
      return abnormal.length > 0
        ? `Key findings: ${abnormal.slice(0, 2).map(r => r.name).join(', ')}`
        : 'All results within normal range';

    case 'vital_signs':
      const vitals = document.vitals || {};
      return `BP ${vitals.bloodPressure?.systolic}/${vitals.bloodPressure?.diastolic}, HR ${vitals.heartRate}, Temp ${vitals.temperature}°F`;

    default:
      // Generic preview: first 100 chars of text content
      const text = JSON.stringify(document).substring(0, 100);
      return text + '...';
  }
}
```

---

## MongoDB Queries

### Count Documents per Collection
```javascript
// Using aggregation for efficiency
const counts = await Promise.all(
  collectionNames.map(async (collectionName) => {
    const count = await db.collection(collectionName).countDocuments({
      patientId: patientId
    });
    return { [collectionName]: count };
  })
);

const countsObject = Object.assign({}, ...counts);
```

### Get Documents Sorted by Date
```javascript
const documents = await db.collection(categoryName).find({
  patientId: patientId
})
.sort({ date: -1 })  // Newest first
.limit(100)
.toArray();
```

### Get Single Document with Security
```javascript
const document = await db.collection(categoryName).findOne({
  _id: new ObjectId(documentId),
  patientId: patientId  // Must match!
});

if (!document) {
  throw new Error('Document not found or access denied');
}
```

---

## Redis Caching

### Cache Patient Document Counts
```javascript
const cacheKey = `patient_doc_counts:${patientId}`;
const TTL = 300;  // 5 minutes

// Try cache first
const cached = await redisService.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

// Compute counts
const counts = await computeDocumentCounts(patientId);

// Store in cache
await redisService.setex(cacheKey, TTL, JSON.stringify(counts));

return counts;
```

### Invalidate Cache on New Data
```javascript
// When new document added
async function onDocumentAdded(patientId, categoryName) {
  // Invalidate counts cache
  await redisService.del(`patient_doc_counts:${patientId}`);

  // Invalidate category documents cache
  await redisService.del(`patient_docs:${patientId}:${categoryName}`);
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid category: unknown_collection"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Document not found"
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to fetch documents"
}
```

---

## Performance Targets

- **Category list**: <200ms (with caching)
- **Document list**: <500ms (up to 100 documents)
- **Document detail**: <300ms (single document)

## Security Checks

1. **Session validation**: Ensure user is authenticated
2. **Practice context**: Verify user's practice matches patient
3. **Patient ID verification**: Ensure document.patientId === requested patientId
4. **Permission checks**: Verify read:patient_data permission
5. **Rate limiting**: Prevent abuse

---

**Reference**: Use this document for API integration and data flow understanding.
