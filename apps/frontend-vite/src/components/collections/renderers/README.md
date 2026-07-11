# Collection Renderers - Quick Reference
**Created: October 10, 2025**

## Purpose
Frontend rendering components for individual medical collections (Path 2 of two-path architecture).

## File Structure
```
renderers/
├── README.md                              (this file)
├── CollectionRenderer.jsx                 (main router)
├── CollectionRenderer.css                 (shared styles)
├── MedicationsRenderer.jsx                ✅ IMPLEMENTED
└── [15 stub renderers].jsx                ⏳ TODO
```

## Usage

### From Parent Component
```javascript
import CollectionRenderer from './components/collections/renderers/CollectionRenderer';

function MedicalDataView({ patientId }) {
  const [medications, setMedications] = useState([]);

  // Fetch data via API
  useEffect(() => {
    fetch(`/api/medical/medications/${patientId}`)
      .then(res => res.json())
      .then(data => setMedications(data));
  }, [patientId]);

  return (
    <CollectionRenderer
      collection="medications"
      data={medications}
      patientId={patientId}
    />
  );
}
```

### Router automatically selects correct renderer
- `collection="medications"` → MedicationsRenderer
- `collection="lab_results"` → LabResultsRenderer (stub)
- Unknown collection → Generic JSON view

## Renderer Implementation Pattern

### Minimal Stub (Current State)
```javascript
import React from 'react';
import './CollectionRenderer.css';

const MyRenderer = ({ data, patientId }) => {
  return (
    <div className="collection-renderer">
      <div className="collection-header">
        <h2>My Collection</h2>
        <span className="record-count">{data?.length || 0} records</span>
      </div>
      <div className="collection-content">
        <p className="no-data">Renderer not yet implemented</p>
      </div>
    </div>
  );
};

export default MyRenderer;
```

### Full Implementation (See MedicationsRenderer.jsx)
1. **Card-based layout** - One card per record
2. **Status badges** - Color-coded status indicators
3. **Smart date formatting** - Locale-aware date display
4. **Responsive grid** - Auto-layout for fields
5. **Empty states** - "No data" messages
6. **Field validation** - Safe rendering of optional fields

## Available CSS Classes

### Layout
- `collection-renderer` - Main container
- `collection-header` - Header with title + count
- `collection-content` - Content area
- `collection-card` - Individual record card

### Typography
- `collection-card-title` - Card title (e.g., medication name)
- `collection-field-label` - Field label (uppercase, gray)
- `collection-field-value` - Field value (white text)

### Status Badges
- `status-badge` - Base badge class
- `status-active` - Green (active)
- `status-inactive` - Gray (inactive/completed)
- `status-discontinued` - Red (discontinued/stopped)
- `status-pending` - Yellow (pending)

### Priority Badges
- `priority-high` - Red
- `priority-medium` - Yellow/orange
- `priority-low` - Blue

### Utilities
- `no-data` - Empty state message
- `json-view` - Generic JSON display
- `record-count` - Badge with count

## Implementation Checklist

When implementing a new renderer:

1. **Replace stub** - Delete "TODO" and implement full renderer
2. **Study data structure** - Check MongoDB schema for fields
3. **Create card layout** - Use `collection-card` pattern
4. **Add status badges** - If applicable (status, priority, severity)
5. **Format dates** - Use `formatDate()` helper
6. **Handle empty states** - "No data" messages
7. **Test with real data** - Use existing Hospital Discharge data
8. **Update checkpoint** - Mark as complete in COLLECTION_RENDERING_CHECKPOINT.md

## Next Renderers to Implement (Priority Order)

### Phase 2: Universal Collections
1. **DiagnosesRenderer** - ICD codes, dates, providers
2. **LabResultsRenderer** - Test names, values, ranges, flags
3. **VitalSignsRenderer** - BP, HR, temp, O2 sat (trending)
4. **AllergiesRenderer** - Allergen, reaction, severity

### Phase 3: Procedures
5. **ProceduresRenderer** - Procedure name, date, provider

### Phase 4: AI Collections (Complex)
6. **ClinicalDecisionSupportRenderer** - Priority cards, insights
7. **IntelligentRecommendationsRenderer** - Action items
8. **TrendingAnalysisRenderer** - Charts/graphs
9. (etc. - 8 total AI renderers)

## Testing

### Check Data Exists
```bash
MONGO_URI=$(cat apps/backend-api/.kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
print('medications: ' + db.medications.countDocuments());
print('diagnoses: ' + db.diagnoses.countDocuments());
print('labresults: ' + db.labresults.countDocuments());
"
```

### Manual Test via WebGUI
1. Start frontend: `cd apps/frontend-vite && npm run dev`
2. Request: "Show me [patient]'s medications"
3. Verify MedicationsRenderer displays correctly

## Documentation
- **Framework**: `apps/backend-api/services/utils/collectionFormatters/FRAMEWORK.md`
- **Checkpoint**: `/home/erangross/Development/IntelliCare/COLLECTION_RENDERING_CHECKPOINT.md`
- **Status**: `/home/erangross/Development/IntelliCare/COLLECTION_RENDERING_STATUS.md`
