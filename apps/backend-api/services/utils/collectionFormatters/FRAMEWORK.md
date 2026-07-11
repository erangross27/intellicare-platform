# Collection Rendering Framework
**Created: October 2025**

## Purpose
Two-path rendering system for medical collections:
- **Backend (Layer 2)**: Text formatters for Claude AI conversation context
- **Frontend (Layer 3)**: React renderers for doctor UI viewing
- **Data Fetch (Layer 1)**: Already exists in `medicalDataService.getMedicalData()`

## Architecture

### Backend Formatters (This Directory)
**Location**: `apps/backend-api/services/utils/collectionFormatters/`
**Purpose**: Convert medical data → Text summaries for Claude AI
**Pattern**: `{collection_name}.js` exports `format()` function

**Template**:
```javascript
module.exports = {
  format(data, options = {}) {
    // Convert array of records to readable text
    // Return string for Claude conversation context
  }
};
```

### Frontend Renderers
**Location**: `apps/frontend-vite/src/components/collections/renderers/`
**Purpose**: React components for doctor viewing
**Pattern**: `{CollectionName}Renderer.jsx`

**Template**:
```javascript
const MedicationsRenderer = ({ data, patientId }) => {
  // Render array of records as beautiful UI
  return <div className="collection-renderer">{...}</div>;
};
export default MedicationsRenderer;
```

## Collections to Implement (16 Total)

### Universal Collections (7)
1. **medications** - All medication records
2. **diagnoses** - All diagnosis records
3. **lab_results** - Laboratory test results
4. **vital_signs** - Vital signs measurements
5. **allergies** - Allergy records
6. **imaging_reports** - Imaging studies (X-ray, CT, MRI)
7. **procedures** - Medical procedures performed

### AI Collections (8)
8. **clinical_decision_support** - AI-generated clinical recommendations
9. **intelligent_recommendations** - Smart treatment suggestions
10. **trending_analysis** - Trend detection across data
11. **patient_specific_care_plan** - Personalized care plans
12. **medication_optimization** - Medication review suggestions
13. **follow_up_intelligence** - Follow-up recommendations
14. **patient_education_context** - Patient education materials
15. **outcomes_prediction** - Predictive analytics

### Compliance Collection (1)
16. **guideline_compliance** - Clinical guideline adherence tracking

## Implementation Order

### Phase 1: Proof of Concept (medications)
- Backend: `medications.js` formatter
- Frontend: `MedicationsRenderer.jsx`
- Router: `CollectionRenderer.jsx` framework

### Phase 2: Top 5 Universal (diagnoses, labs, vitals, allergies)
- One collection at a time
- Test each before moving to next

### Phase 3: Imaging & Procedures
- imaging_reports, procedures

### Phase 4: AI Collections (8 collections)
- More complex rendering (cards, charts, priority indicators)

### Phase 5: Compliance
- guideline_compliance

## File Naming Convention
- **Backend**: `{collection_name}.js` (lowercase with underscores)
- **Frontend**: `{CollectionName}Renderer.jsx` (PascalCase)
- **Router**: `CollectionRenderer.jsx` (main routing component)

## Progress Tracking
See `CHECKPOINT.md` for detailed progress tracking.
