# Agent 3: Fix PDF Templates 23-33

## Your Collections (11 templates):
1. consultation_notes
2. progress_notes
3. discharge_summaries
4. hospital_discharge_summaries
5. emergency_discharge_summaries
6. operative_reports
7. admission_assessments
8. hospital_admission_notes
9. history_present_illness
10. pathology_reports
11. doctors_medications_recommendations_optimizations

## Instructions:

### Step 1: For EACH collection, query the database
Use MCP MongoDB tool:
```
mcp__MongoDB-IntelliCare__find
  database: intellicare_practice_yale
  collection: consultation_notes (replace with each collection name)
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
- ConsultationNotesTemplate.jsx
- ProgressNotesTemplate.jsx
- DischargeSummariesTemplate.jsx
- HospitalDischargeSummariesTemplate.jsx
- EmergencyDischargeSummariesTemplate.jsx
- OperativeReportsTemplate.jsx
- AdmissionAssessmentsTemplate.jsx
- HospitalAdmissionNotesTemplate.jsx
- HistoryPresentIllnessTemplate.jsx
- PathologyReportsTemplate.jsx
- DoctorsMedicationsRecommendationsOptimizationsTemplate.jsx

Working directory: /home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/artifact/pdf-templates/
