# Agent 4: Fix PDF Templates 34-43

## Your Collections (10 templates):
1. current_medications
2. doctors_medications_recommendations
3. medications_optimizations
4. medications
5. psychiatric_evaluations
6. neuropsychological_assessments
7. geriatric_assessments
8. functional_assessment
9. physical_examinations
10. diagnoses

## Instructions:

### Step 1: For EACH collection, query the database
Use MCP MongoDB tool:
```
mcp__MongoDB-IntelliCare__find
  database: intellicare_practice_yale
  collection: current_medications (replace with each collection name)
  filter: {}
  limit: 1
```

### Step 2: Check data structure
Look at the result:
- Root level? `{date: "...", field: "..."}`
- Nested in extractedData? `{extractedData: {fieldName: {date: "...", field: "..."}}}`

### Step 3: Update template if nested
Add at top of component:
```javascript
const data = document.extractedData?.yourFieldName || document.yourFieldName || document;
```

Then replace all `document.field` with `data.field`

### Step 4: Keep date at root
ALWAYS keep: `{document.date && ...}` - date is at root level

## Files to Fix:
- CurrentMedicationsTemplate.jsx
- DoctorsMedicationsRecommendationsTemplate.jsx
- MedicationsOptimizationsTemplate.jsx
- MedicationsTemplate.jsx
- PsychiatricEvaluationsTemplate.jsx
- NeuropsychologicalAssessmentsTemplate.jsx
- GeriatricAssessmentsTemplate.jsx
- FunctionalAssessmentTemplate.jsx
- PhysicalExaminationsTemplate.jsx
- DiagnosesTemplate.jsx

Working directory: /home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/artifact/pdf-templates/
