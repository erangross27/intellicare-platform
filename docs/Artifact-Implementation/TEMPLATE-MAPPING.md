# Template Mapping Reference

## Collection → Template Mapping

This document defines which template is used for each medical collection.

## Complete Mapping

```javascript
export const COLLECTION_TEMPLATES = {
  // ═══════════════════════════════════════════════════════════
  // MEDICATIONS
  // ═══════════════════════════════════════════════════════════
  'medications': 'MedicationDocument',
  'medication_optimization': 'ComparisonDocument',
  'doctors_medications_recommendations_optimizations': 'ComparisonDocument',

  // ═══════════════════════════════════════════════════════════
  // LABORATORY RESULTS
  // ═══════════════════════════════════════════════════════════
  'lab_results': 'LabResultsDocument',
  'lab_trending': 'TrendingDocument',

  // ═══════════════════════════════════════════════════════════
  // VITAL SIGNS
  // ═══════════════════════════════════════════════════════════
  'vital_signs': 'VitalSignsDocument',
  'vital_signs_table': 'TableDocument',

  // ═══════════════════════════════════════════════════════════
  // AI-GENERATED INSIGHTS
  // ═══════════════════════════════════════════════════════════
  'intelligent_recommendations': 'AIInsightsDocument',
  'clinical_decision_support': 'AIInsightsDocument',
  'follow_up_intelligence': 'AIInsightsDocument',
  'patient_education_context': 'NarrativeDocument',
  'patient_specific_care_plan': 'NarrativeDocument',

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSES
  // ═══════════════════════════════════════════════════════════
  'diagnoses': 'DiagnosisDocument',

  // ═══════════════════════════════════════════════════════════
  // ALLERGIES
  // ═══════════════════════════════════════════════════════════
  'allergies': 'AllergyDocument',

  // ═══════════════════════════════════════════════════════════
  // PROCEDURES
  // ═══════════════════════════════════════════════════════════
  'medical_procedures': 'ProcedureDocument',
  'procedures': 'ProcedureDocument',

  // ═══════════════════════════════════════════════════════════
  // HOSPITAL COURSE & TIMELINE
  // ═══════════════════════════════════════════════════════════
  'hospital_course': 'TimelineDocument',
  'treatment_courses': 'TimelineDocument',
  'hospital_discharge_summaries': 'TimelineDocument',
  'history_present_illness': 'TimelineDocument',

  // ═══════════════════════════════════════════════════════════
  // QUALITY & METRICS
  // ═══════════════════════════════════════════════════════════
  'quality_metrics': 'QualityMetricsDocument',
  'guideline_compliance': 'QualityMetricsDocument',

  // ═══════════════════════════════════════════════════════════
  // TRENDING & ANALYSIS
  // ═══════════════════════════════════════════════════════════
  'trending_analysis': 'TrendingDocument',

  // ═══════════════════════════════════════════════════════════
  // IMAGING & RADIOLOGY
  // ═══════════════════════════════════════════════════════════
  'imaging_reports': 'ImagingDocument',
  'radiology_reports': 'ImagingDocument',

  // ═══════════════════════════════════════════════════════════
  // SOCIAL & ADMINISTRATIVE
  // ═══════════════════════════════════════════════════════════
  'social_history': 'NarrativeDocument',
  'administrative_data': 'TableDocument',

  // ═══════════════════════════════════════════════════════════
  // ADDITIONAL COLLECTIONS (Add as needed)
  // ═══════════════════════════════════════════════════════════
  'follow_up_appointments': 'TableDocument',
  'patient_education_records': 'NarrativeDocument',
  'discharge_planning': 'NarrativeDocument',

  // ═══════════════════════════════════════════════════════════
  // WILDCARD PATTERNS (matched with regex)
  // ═══════════════════════════════════════════════════════════
  '*_table': 'TableDocument',
  '*_summary': 'SummaryDocument',
  '*_analysis': 'TrendingDocument',
  '*_report': 'NarrativeDocument',

  // ═══════════════════════════════════════════════════════════
  // DEFAULT FALLBACK
  // ═══════════════════════════════════════════════════════════
  'default': 'NarrativeDocument'
};
```

## Template Descriptions

### MedicationDocument
**Purpose**: Display medications with dosing, indications, and safety info
**Best for**: medications, current_medications, medication_list
**Features**:
- Active vs discontinued sections
- Dose, route, frequency details
- Indication and prescriber
- Clinical notes and response
- Safety checks and interactions

---

### LabResultsDocument
**Purpose**: Display laboratory test results in tables
**Best for**: lab_results, laboratory_tests, blood_work
**Features**:
- Results grouped by category (Hematology, Chemistry, etc.)
- Tables with result, unit, normal range, status
- Abnormal values highlighted
- Critical findings section
- Trending info if available

---

### VitalSignsDocument
**Purpose**: Display vital signs and measurements
**Best for**: vital_signs, vitals, measurements
**Features**:
- Current vitals display
- Status indicators (normal/abnormal)
- Trending arrows (↗️ ↘️ →)
- BMI calculation
- Measurement history

---

### AIInsightsDocument
**Purpose**: Display AI-generated recommendations and insights
**Best for**: intelligent_recommendations, clinical_decision_support, follow_up_intelligence
**Features**:
- Priority sections (Immediate/Short-term/Long-term)
- Numbered recommendations
- Rationale explanations
- Timeframes and context
- Action items

---

### DiagnosisDocument
**Purpose**: Display patient diagnoses
**Best for**: diagnoses, diagnosis_list, conditions
**Features**:
- Primary diagnosis prominent
- Secondary diagnoses list
- ICD-10 codes
- Onset dates
- Status (active/resolved)
- Clinical notes

---

### AllergyDocument
**Purpose**: Display allergies and adverse reactions
**Best for**: allergies, adverse_reactions
**Features**:
- Allergen name
- Reaction type
- Severity
- Date identified
- Clinical notes

---

### ProcedureDocument
**Purpose**: Display medical procedures
**Best for**: medical_procedures, procedures, surgeries
**Features**:
- Procedure name and CPT code
- Date performed
- Provider
- Indication
- Outcome
- Complications (if any)

---

### TimelineDocument
**Purpose**: Display chronological events
**Best for**: hospital_course, treatment_courses, history_present_illness
**Features**:
- Timeline layout
- Date markers
- Event descriptions
- Provider notes
- Outcomes

---

### TrendingDocument
**Purpose**: Display trending analysis with charts/graphs
**Best for**: trending_analysis, lab_trending, *_analysis
**Features**:
- Trend charts (if data available)
- Comparison over time
- Rate of change
- Predictions
- Clinical significance

---

### QualityMetricsDocument
**Purpose**: Display quality metrics and compliance
**Best for**: quality_metrics, guideline_compliance
**Features**:
- Metric scores
- Compliance indicators
- Gap analysis
- Recommendations
- Benchmark comparisons

---

### ImagingDocument
**Purpose**: Display imaging and radiology reports
**Best for**: imaging_reports, radiology_reports, xray_reports
**Features**:
- Study type and date
- Findings section
- Impression section
- Recommendations
- Comparison to prior studies

---

### ComparisonDocument
**Purpose**: Display side-by-side comparisons
**Best for**: medication_optimization, doctors_medications_recommendations_optimizations
**Features**:
- Side-by-side layout
- Comparison tables
- Pros/cons lists
- Cost analysis
- Recommendations

---

### TableDocument (Generic Fallback)
**Purpose**: Display structured data in table format
**Best for**: Any collection ending in "_table" or with tabular data
**Features**:
- Automatic table generation from data
- Column headers
- Sortable (optional)
- Filterable (optional)

---

### NarrativeDocument (Generic Fallback)
**Purpose**: Display text-based narrative content
**Best for**: Any collection with primarily text data
**Features**:
- Clean typography
- Section headers
- Paragraphs
- Lists
- Quotes

---

### SummaryDocument (Generic Fallback)
**Purpose**: Display summary information
**Best for**: Any collection ending in "_summary"
**Features**:
- Executive summary layout
- Key points highlighted
- Bullet lists
- Concise format

---

## Category Metadata

```javascript
export const CATEGORY_METADATA = {
  'medications': {
    displayName: 'Medications',
    icon: '💊',
    description: 'Current and past medications',
    sortOrder: 1
  },
  'lab_results': {
    displayName: 'Lab Results',
    icon: '🔬',
    description: 'Laboratory test results',
    sortOrder: 2
  },
  'vital_signs': {
    displayName: 'Vital Signs',
    icon: '📊',
    description: 'Vital signs and measurements',
    sortOrder: 3
  },
  'diagnoses': {
    displayName: 'Diagnoses',
    icon: '🏥',
    description: 'Patient diagnoses and conditions',
    sortOrder: 4
  },
  'allergies': {
    displayName: 'Allergies',
    icon: '🚨',
    description: 'Allergies and adverse reactions',
    sortOrder: 5
  },
  'medical_procedures': {
    displayName: 'Procedures',
    icon: '🔪',
    description: 'Medical procedures and surgeries',
    sortOrder: 6
  },
  'hospital_course': {
    displayName: 'Hospital Course',
    icon: '🏥',
    description: 'Hospital admissions and course',
    sortOrder: 7
  },
  'intelligent_recommendations': {
    displayName: 'AI Recommendations',
    icon: '💡',
    description: 'AI-generated clinical recommendations',
    sortOrder: 8
  },
  'clinical_decision_support': {
    displayName: 'Clinical Decision Support',
    icon: '🎯',
    description: 'Clinical decision support insights',
    sortOrder: 9
  },
  'trending_analysis': {
    displayName: 'Trending Analysis',
    icon: '📈',
    description: 'Trending analysis over time',
    sortOrder: 10
  },
  'quality_metrics': {
    displayName: 'Quality Metrics',
    icon: '⚕️',
    description: 'Quality metrics and compliance',
    sortOrder: 11
  },
  'medication_optimization': {
    displayName: 'Medication Optimization',
    icon: '💊',
    description: 'Medication optimization analysis',
    sortOrder: 12
  },
  'doctors_medications_recommendations_optimizations': {
    displayName: "Doctor's Medication Recommendations",
    icon: '💊',
    description: "Doctor's medication recommendations with AI optimization",
    sortOrder: 13
  },
  'follow_up_intelligence': {
    displayName: 'Follow-up Intelligence',
    icon: '📅',
    description: 'Follow-up tasks and priorities',
    sortOrder: 14
  },
  'patient_education_context': {
    displayName: 'Patient Education',
    icon: '📚',
    description: 'Patient education materials',
    sortOrder: 15
  },
  'imaging_reports': {
    displayName: 'Imaging Reports',
    icon: '🔍',
    description: 'Radiology and imaging reports',
    sortOrder: 16
  },
  'social_history': {
    displayName: 'Social History',
    icon: '👥',
    description: 'Social history and lifestyle',
    sortOrder: 17
  },
  'administrative_data': {
    displayName: 'Administrative Data',
    icon: '📋',
    description: 'Administrative and demographic data',
    sortOrder: 18
  }
};
```

## Template Selection Algorithm

```javascript
export function getTemplateForCollection(collectionName) {
  // 1. Try direct match
  if (COLLECTION_TEMPLATES[collectionName]) {
    return COLLECTION_TEMPLATES[collectionName];
  }

  // 2. Try wildcard patterns
  const wildcardPatterns = Object.keys(COLLECTION_TEMPLATES)
    .filter(key => key.includes('*'));

  for (const pattern of wildcardPatterns) {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    if (regex.test(collectionName)) {
      return COLLECTION_TEMPLATES[pattern];
    }
  }

  // 3. Default fallback
  return COLLECTION_TEMPLATES['default'];
}

export function getMetadataForCollection(collectionName) {
  if (CATEGORY_METADATA[collectionName]) {
    return CATEGORY_METADATA[collectionName];
  }

  // Generate metadata if not found
  return {
    displayName: collectionName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase()),
    icon: '📄',
    description: 'Medical data',
    sortOrder: 999
  };
}
```

## Adding New Collections

To add support for a new collection:

### 1. Determine Template
Decide which existing template fits best, or create new template if needed.

### 2. Add to Mapping
```javascript
COLLECTION_TEMPLATES['new_collection_name'] = 'TemplateName';
```

### 3. Add Metadata
```javascript
CATEGORY_METADATA['new_collection_name'] = {
  displayName: 'Display Name',
  icon: '📄',
  description: 'Description of this category',
  sortOrder: 20  // Position in category list
};
```

### 4. Test
- Verify template selection works
- Check document renders correctly
- Test with real data

## Template Priority (for wildcards)

When multiple patterns match, first match wins:

1. **Exact match**: `medications` → exact key in map
2. **Wildcard match**: `lab_trending` → matches `*_trending`
3. **Default**: No match → use `default` template

Order wildcards by specificity (most specific first):
```javascript
'*_trending_analysis': 'TrendingDocument',  // More specific
'*_analysis': 'TrendingDocument',          // Less specific
```

---

**Reference**: Use this document when adding new collections or templates.
