# Phase 4: Integration Tasks

## Overview
Wire everything together and replace grid system.

**Duration**: 3-4 days
**Tasks**: 6 total
**Dependencies**: Phases 1, 2, 3 complete

---

## Task 4.1: Create Collection-to-Template Mapping Config ⏱️ 2-3 hours

### Goal
Create configuration file mapping all 30-40 medical collections to templates.

### File to Create
`apps/frontend-vite/src/config/documentTemplates.js`

### Configuration Structure
```javascript
/**
 * Maps collection names to document templates
 */
export const COLLECTION_TEMPLATES = {
  // Medications
  'medications': 'MedicationDocument',
  'medication_optimization': 'ComparisonDocument',
  'doctors_medications_recommendations_optimizations': 'ComparisonDocument',

  // Labs
  'lab_results': 'LabResultsDocument',
  'lab_trending': 'TrendingDocument',

  // Vitals
  'vital_signs': 'VitalSignsDocument',
  'vital_signs_table': 'TableDocument',
  'trending_analysis': 'TrendingDocument',

  // AI Insights
  'intelligent_recommendations': 'AIInsightsDocument',
  'clinical_decision_support': 'AIInsightsDocument',
  'follow_up_intelligence': 'AIInsightsDocument',
  'patient_education_context': 'NarrativeDocument',
  'patient_specific_care_plan': 'NarrativeDocument',

  // Diagnoses
  'diagnoses': 'DiagnosisDocument',

  // Procedures
  'medical_procedures': 'ProcedureDocument',
  'procedures': 'ProcedureDocument',

  // Timeline
  'hospital_course': 'TimelineDocument',
  'treatment_courses': 'TimelineDocument',
  'hospital_discharge_summaries': 'TimelineDocument',

  // Quality
  'quality_metrics': 'QualityMetricsDocument',
  'guideline_compliance': 'QualityMetricsDocument',

  // Allergies
  'allergies': 'AllergyDocument',

  // Imaging
  'imaging_reports': 'ImagingDocument',
  'radiology_reports': 'ImagingDocument',

  // Fallback patterns (using wildcards)
  '*_table': 'TableDocument',
  '*_summary': 'SummaryDocument',
  'default': 'NarrativeDocument'
};

/**
 * Metadata for each collection category
 */
export const CATEGORY_METADATA = {
  'medications': {
    displayName: 'Medications',
    icon: '💊',
    description: 'Current and past medications'
  },
  'lab_results': {
    displayName: 'Lab Results',
    icon: '🔬',
    description: 'Laboratory test results'
  },
  'vital_signs': {
    displayName: 'Vital Signs',
    icon: '📊',
    description: 'Vital signs and measurements'
  },
  'diagnoses': {
    displayName: 'Diagnoses',
    icon: '🏥',
    description: 'Patient diagnoses'
  },
  'allergies': {
    displayName: 'Allergies',
    icon: '🚨',
    description: 'Allergies and adverse reactions'
  },
  'medical_procedures': {
    displayName: 'Procedures',
    icon: '🔪',
    description: 'Medical procedures and surgeries'
  },
  'hospital_course': {
    displayName: 'Hospital Course',
    icon: '🏥',
    description: 'Hospital admissions and course'
  },
  'intelligent_recommendations': {
    displayName: 'AI Recommendations',
    icon: '💡',
    description: 'AI-generated clinical recommendations'
  },
  'trending_analysis': {
    displayName: 'Trending Analysis',
    icon: '📈',
    description: 'Trending analysis over time'
  },
  'quality_metrics': {
    displayName: 'Quality Metrics',
    icon: '⚕️',
    description: 'Quality metrics and compliance'
  },
  'clinical_decision_support': {
    displayName: 'Clinical Decision Support',
    icon: '🎯',
    description: 'Clinical decision support'
  },
  'medication_optimization': {
    displayName: 'Medication Optimization',
    icon: '💊',
    description: 'Medication optimization analysis'
  },
  'doctors_medications_recommendations_optimizations': {
    displayName: "Doctor's Medication Recommendations",
    icon: '💊',
    description: "Doctor's medication recommendations with AI optimization"
  },
  'follow_up_intelligence': {
    displayName: 'Follow-up Intelligence',
    icon: '📅',
    description: 'Follow-up tasks and priorities'
  },
  'patient_education_context': {
    displayName: 'Patient Education',
    icon: '📚',
    description: 'Patient education materials'
  },
  'imaging_reports': {
    displayName: 'Imaging Reports',
    icon: '🔍',
    description: 'Radiology and imaging reports'
  }
  // ... add all 30-40 categories
};

/**
 * Get template name for a collection
 */
export function getTemplateForCollection(collectionName) {
  // Direct match
  if (COLLECTION_TEMPLATES[collectionName]) {
    return COLLECTION_TEMPLATES[collectionName];
  }

  // Wildcard match
  for (const [pattern, template] of Object.entries(COLLECTION_TEMPLATES)) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      if (regex.test(collectionName)) {
        return template;
      }
    }
  }

  // Default fallback
  return COLLECTION_TEMPLATES.default;
}

/**
 * Get metadata for a collection
 */
export function getMetadataForCollection(collectionName) {
  return CATEGORY_METADATA[collectionName] || {
    displayName: collectionName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    icon: '📄',
    description: 'Medical data'
  };
}
```

### What to Build
1. Complete mapping for all collections
2. Metadata for display names and icons
3. Wildcard pattern matching
4. Helper functions
5. Default fallbacks

### Testing
- All known collections map correctly
- Wildcards work
- Default fallback works
- Metadata retrieved correctly

---

## Task 4.2: Update Chat to Trigger Artifact Panel ⏱️ 4-5 hours

### Goal
Make chat recognize medical data requests and open artifact panel.

### Files to Modify
- Chat component (main chat interface)
- AI message handling logic

### Logic to Add
```javascript
// In chat message handler
const handleAIResponse = (message) => {
  // Check if response contains medical data request
  if (message.triggerArtifact) {
    openArtifactPanel({
      level: message.artifactLevel,     // 'categories' | 'documents' | 'detail'
      category: message.category,       // e.g., 'medications'
      documentId: message.documentId    // if specific document
    });
  }

  // Display message in chat
  displayMessage(message);
};
```

### Backend Integration
Modify AI service to detect medical data requests:

```javascript
// In agentServiceV4.js or similar
async function processUserMessage(message) {
  // Check if user is asking for medical data
  const medicalDataRequest = detectMedicalDataRequest(message);

  if (medicalDataRequest) {
    return {
      text: "I'll show you that data in the artifact panel.",
      triggerArtifact: true,
      artifactLevel: medicalDataRequest.level,
      category: medicalDataRequest.category,
      documentId: medicalDataRequest.documentId
    };
  }

  // ... normal chat processing
}

function detectMedicalDataRequest(message) {
  const lower = message.toLowerCase();

  // General data request
  if (lower.includes('show me medical data') ||
      lower.includes('patient data') ||
      lower.includes('medical records')) {
    return { level: 'categories' };
  }

  // Category-specific request
  const categories = [
    { keywords: ['medication', 'meds', 'drugs'], name: 'medications' },
    { keywords: ['lab', 'labs', 'laboratory'], name: 'lab_results' },
    { keywords: ['vitals', 'vital signs', 'bp', 'blood pressure'], name: 'vital_signs' },
    { keywords: ['diagnosis', 'diagnoses'], name: 'diagnoses' }
    // ... more categories
  ];

  for (const category of categories) {
    if (category.keywords.some(kw => lower.includes(kw))) {
      return { level: 'documents', category: category.name };
    }
  }

  return null;
}
```

### Frontend State Management
```javascript
const [artifactState, setArtifactState] = useState({
  isOpen: false,
  level: null,
  category: null,
  documentId: null
});

const openArtifactPanel = ({ level, category, documentId }) => {
  setArtifactState({
    isOpen: true,
    level: level || 'categories',
    category,
    documentId
  });
};
```

### What to Build
1. Message detection for medical data requests
2. Artifact trigger in AI responses
3. Frontend state management
4. Panel opening logic
5. Level/category/document routing

### Testing
- "Show me medical data" opens category list
- "Show me medications" opens medication list
- Specific requests work
- Panel opens with correct level

---

## Task 4.3: Replace Grid Components with Artifact Calls ⏱️ 6-8 hours

### Goal
Remove all grid components and replace with artifact panel triggers.

### Files to Find and Modify
Search for grid component usage:
```bash
# Find all grid references
grep -r "MedicalDataGrid" apps/frontend-vite/src/
grep -r "GridComponent" apps/frontend-vite/src/
grep -r "<Grid " apps/frontend-vite/src/
```

### Replacement Pattern
**Before:**
```jsx
<MedicalDataGrid
  patientId={patientId}
  collection="medications"
  columns={medicationColumns}
/>
```

**After:**
```jsx
<ArtifactTriggerButton
  label="View Medications"
  icon="💊"
  onClick={() => openArtifact('documents', 'medications')}
/>
```

### Component to Create
```jsx
// ArtifactTriggerButton.jsx
const ArtifactTriggerButton = ({ label, icon, onClick, description }) => {
  return (
    <button className="artifact-trigger" onClick={onClick}>
      <span className="icon">{icon}</span>
      <span className="label">{label}</span>
      {description && <span className="description">{description}</span>}
      <span className="arrow">→</span>
    </button>
  );
};
```

### Areas to Update
1. **Patient Dashboard** - Replace all grid calls
2. **Medical Data Page** - Replace grid displays
3. **Chat Interface** - Add artifact triggers
4. **Quick Access Panels** - Update to use artifact
5. **Reports Page** - Convert to artifact triggers

### What to Build
1. Find all grid references
2. Create ArtifactTriggerButton component
3. Replace each grid with trigger button
4. Test all replacements work
5. Remove old grid components

### Testing
- All old grid locations now use artifact
- Buttons trigger correct artifact level
- No broken references
- All data still accessible

---

## Task 4.4: Add Sidebar Collapse Logic ⏱️ 2-3 hours

### Goal
Auto-collapse right sidebar when artifact opens, restore when closed.

### Files to Modify
- Main layout component
- Sidebar component

### State Management
```javascript
const [layout, setLayout] = useState({
  artifactOpen: false,
  rightSidebarCollapsed: false
});

const openArtifact = () => {
  setLayout({
    artifactOpen: true,
    rightSidebarCollapsed: true  // Collapse when artifact opens
  });
};

const closeArtifact = () => {
  setLayout({
    artifactOpen: false,
    rightSidebarCollapsed: false  // Restore when artifact closes
  });
};
```

### CSS Updates
```css
/* Main layout */
.main-layout {
  display: flex;
  height: 100vh;
}

.left-sidebar {
  width: 250px;
  flex-shrink: 0;
}

.content-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.chat-area {
  transition: width 0.3s ease;
}

.chat-area.full-width {
  width: 100%;
}

.chat-area.half-width {
  width: 50%;
}

.right-sidebar {
  width: 300px;
  transition: all 0.3s ease;
}

.right-sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}
```

### What to Build
1. State management for sidebar collapse
2. Auto-collapse on artifact open
3. Auto-restore on artifact close
4. Smooth animations
5. Responsive behavior

### Testing
- Sidebar collapses when artifact opens
- Sidebar restores when artifact closes
- Animations smooth
- Layout doesn't break

---

## Task 4.5: Test All Collections Render Correctly ⏱️ 4-6 hours

### Goal
Systematically test all 30-40 collections with real data.

### Testing Checklist
Create spreadsheet or document tracking:
```
Collection Name | Template | Has Data | Renders OK | Notes
medications     | Medication | Yes    | ✅        | Perfect
lab_results     | LabResults | Yes    | ✅        | Tables good
vital_signs     | VitalSigns | Yes    | ⚠️        | Missing units
...
```

### Test Process for Each Collection
1. Open artifact panel
2. Navigate to category
3. Select document
4. Verify:
   - Data loads correctly
   - Template renders properly
   - All fields displayed
   - Print looks good
   - No console errors

### Common Issues to Check
- Missing data fields
- Incorrect template mapping
- Date formatting errors
- Empty sections
- Print layout problems

### What to Build
1. Test plan document
2. Go through all collections
3. Document issues
4. Fix template problems
5. Update mappings if needed

### Testing
- All collections tested
- Issues documented
- Fixes implemented
- Retested and passing

---

## Task 4.6: Handle Edge Cases and Errors ⏱️ 3-4 hours

### Goal
Implement comprehensive error handling and edge cases.

### Edge Cases to Handle

**1. Empty Data**
```jsx
// No documents in category
{documents.length === 0 && (
  <div className="empty-state">
    <p>📄 No {category.displayName} found for this patient.</p>
  </div>
)}
```

**2. Network Errors**
```jsx
{error && (
  <div className="error-state">
    <p>⚠️ Failed to load data: {error.message}</p>
    <button onClick={retry}>Retry</button>
  </div>
)}
```

**3. Invalid Data Structure**
```jsx
// Template receives unexpected data
try {
  renderData(data);
} catch (error) {
  return <div className="error">Unable to display this document.</div>;
}
```

**4. Permission Errors**
```jsx
// 403 Forbidden
if (response.status === 403) {
  return <div className="error">You don't have permission to view this data.</div>;
}
```

**5. Large Documents**
```jsx
// Very long documents
{content.length > 10000 && (
  <button onClick={toggleFullView}>
    {showFull ? 'Show less' : 'Show more'}
  </button>
)}
```

### What to Build
1. Empty state components
2. Error state components
3. Loading states
4. Permission denied states
5. Data validation
6. Retry logic
7. Fallback templates

### Testing
- Empty data displays properly
- Network errors handled
- Invalid data doesn't crash
- Permission errors clear
- Large documents performant

---

## Completion Checklist

After completing all tasks:
- [ ] Collection mapping complete
- [ ] Chat triggers artifact
- [ ] All grids replaced
- [ ] Sidebar collapse working
- [ ] All collections tested
- [ ] Edge cases handled
- [ ] Error handling complete
- [ ] Ready for final testing

---

**Total Time**: 3-4 days
**Dependencies**: Phases 1, 2, 3
**Next Phase**: Polish & Testing
