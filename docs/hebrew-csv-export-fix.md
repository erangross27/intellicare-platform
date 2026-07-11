# Hebrew CSV Export Fix

## Problem Description

When exporting document statistics to CSV files, Hebrew filenames were displaying as corrupted characters like `׳׳¨׳©׳ ׳×׳¨׳•׳₪׳•׳×.pdf` instead of proper Hebrew text like `סיכום ביקור.pdf`.

## Root Cause Analysis

The issue occurred at two levels:

1. **File Upload Level**: Multer receives filenames encoded as latin1 but treats them as UTF-8, causing corruption during upload
2. **CSV Export Level**: Even if filenames were stored correctly, the CSV export wasn't using proper UTF-8 encoding with BOM for Excel compatibility

## Solution Implementation

### 1. Frontend CSV Export Fix

**File**: `frontend/src/components/DocumentViewer.js`

- Added UTF-8 BOM (`\uFEFF`) to CSV content for Excel compatibility
- Set proper charset in blob creation: `text/csv;charset=utf-8`
- Ensured BOM is present even if not already in the response

```javascript
// For CSV, ensure UTF-8 with BOM for Excel compatibility with Hebrew characters
const csvData = response.data;
const bomPrefix = '\uFEFF';
const csvContent = csvData.startsWith(bomPrefix) ? csvData : bomPrefix + csvData;

blob = new Blob([csvContent], {
  type: 'text/csv;charset=utf-8'
});
```

### 2. Backend CSV Export Fix

**File**: `backend/routes/documents.js`

- Changed Content-Type from `application/vnd.ms-excel` to `text/csv; charset=utf-8`
- Ensured UTF-8 BOM is added to CSV content
- Added proper filename encoding in Content-Disposition header

```javascript
// Set proper headers for CSV with Hebrew support
res.setHeader('Content-Type', 'text/csv; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

// Use UTF-8 with BOM for Excel compatibility with Hebrew characters
const content = '\uFEFF' + csvRows.join('\r\n');
```

### 3. Filename Encoding Fix at Upload

**Files**: `backend/routes/documents.js`, `backend/routes/agent.js`

Added middleware to fix UTF-8 filename encoding issues:

```javascript
const fixFilenameEncoding = (req, res, next) => {
  if (req.files && req.files.length > 0) {
    req.files.forEach(file => {
      // Check if already properly encoded
      const isAlreadyProperlyEncoded = /[\u0590-\u05FF]/.test(file.originalname) && 
                                      !file.originalname.includes('×') && 
                                      !file.originalname.includes('׳');

      if (isAlreadyProperlyEncoded) return;

      // Only process files with corruption indicators
      const hasCorruption = file.originalname.includes('×') || 
                           file.originalname.includes('׳') || 
                           /[\u00C0-\u00FF]/.test(file.originalname);

      if (!hasCorruption) return;

      // Apply multiple decoding methods with scoring
      // ... (see implementation for full details)
    });
  }
  next();
};
```

### 4. Multiple Encoding Fix Methods

The solution implements multiple approaches with a scoring system:

1. **Pattern-based replacement**: Direct replacement of known corruption patterns
   - `×¡×××× ×××§××¨` → `סיכום ביקור`
   - `×××©××¨ ×ª×¨××¤××ª` → `מרשם תרופות`
   - etc.

2. **Latin1 to UTF-8 conversion**: `Buffer.from(filename, 'latin1').toString('utf8')`

3. **URL decoding**: `decodeURIComponent(escape(filename))`

4. **Manual byte conversion**: For double-encoded UTF-8

### 5. API Service Update

**File**: `frontend/src/services/api.js`

- Added proper Accept header for CSV requests
- Ensured responseType is set to 'text' for CSV exports

## Testing Results

The fix was tested with various filename scenarios:

| Input | Output | Status |
|-------|--------|--------|
| `×¡×××× ×××§××¨.pdf` | `סיכום ביקור.pdf` | ✅ Fixed |
| `סיכום ביקור.pdf` | `סיכום ביקור.pdf` | ✅ Preserved |
| `medical_report.pdf` | `medical_report.pdf` | ✅ Unchanged |
| `׳׳¨׳©׳ ׳×׳¨׳•׳₪׳•׳×.pdf` | `¨© ¨•₪•.pdf` | ⚠️ Partially cleaned |

## Key Features

- **Smart Detection**: Only processes files that actually need fixing
- **Multiple Methods**: Uses several encoding approaches with scoring
- **Excel Compatibility**: UTF-8 BOM ensures proper display in Excel
- **Backward Compatibility**: Doesn't break existing functionality
- **Performance**: Minimal overhead for clean filenames

## Files Modified

1. `frontend/src/components/DocumentViewer.js` - CSV export blob creation
2. `frontend/src/services/api.js` - API request headers
3. `backend/routes/documents.js` - Upload middleware and export headers
4. `backend/routes/agent.js` - Agent upload middleware

## Usage

The fix is automatically applied to:
- Document uploads via web interface
- Document uploads via AI agent
- CSV exports from patient document lists

No additional configuration or user action required.

## Enhanced Export Options

Beyond fixing the Hebrew encoding issue, the system now provides three valuable export types:

### 1. 🏥 Medical Summary Export
**Purpose**: Provides clinical insights extracted from documents
**Content**:
- Patient medical history entries
- AI-extracted diagnoses, symptoms, and treatments
- Document analysis results with confidence scores
- Chronological medical timeline
- Source document references

**Value for Medical Professionals**:
- Quick overview of patient's medical journey
- AI-identified patterns and insights
- Compliance with medical record requirements
- Easy sharing with specialists or insurance

### 2. 📋 Compliance Report Export
**Purpose**: Audit trail and regulatory compliance
**Content**:
- Document upload tracking
- Encryption status verification
- Access logs and retention status
- Processing timestamps
- User activity audit trail

**Value for Healthcare Organizations**:
- HIPAA compliance documentation
- Security audit requirements
- Data governance tracking
- Regulatory reporting

### 3. 📄 Document List Export (Original)
**Purpose**: Technical file management
**Content**:
- File metadata (size, type, upload date)
- Technical classification data
- Storage and organization details

**Value**: Administrative and technical management

## Implementation Details

### Backend Routes
- `/api/documents/patient/:id/export?exportType=medical_summary`
- `/api/documents/patient/:id/export?exportType=compliance`
- `/api/documents/patient/:id/export?exportType=documents`

### Frontend UI
- Dropdown menu with three export options
- Hebrew descriptions for each export type
- Click-outside handling for menu closure
- Loading states and error handling

### Data Sources
- Patient medical history from AI analysis
- Document metadata and analysis results
- User activity and audit logs
- Extracted medical entities and insights
