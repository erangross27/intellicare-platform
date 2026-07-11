# Agent 1: Fix PDF Templates 1-11

## Your Collections (11 templates):
1. allergy_assessment
2. biopsy_reports
3. case_summaries
4. second_opinion_reports
5. prognosis
6. care_coordination_notes
7. assessment_plans
8. treatment_courses
9. care_coordination
10. monitoring_plan
11. patient_education_records

## Instructions:

### Step 1: For EACH collection, query the database
Use MCP MongoDB tool:
```
mcp__MongoDB-IntelliCare__find
  database: intellicare_practice_yale
  collection: allergy_assessment (replace with each collection name)
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
- AllergyAssessmentTemplate.jsx
- BiopsyReportsTemplate.jsx
- CaseSummariesTemplate.jsx
- SecondOpinionReportsTemplate.jsx
- PrognosisTemplate.jsx
- CareCoordinationNotesTemplate.jsx
- AssessmentPlansTemplate.jsx
- TreatmentCoursesTemplate.jsx
- CareCoordinationTemplate.jsx
- MonitoringPlanTemplate.jsx
- PatientEducationRecordsTemplate.jsx

Working directory: /home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/artifact/pdf-templates/
