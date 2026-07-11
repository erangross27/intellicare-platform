# Agent 2: Fix PDF Templates 12-22

## Your Collections (11 templates):
1. clinical_decision_support
2. intelligent_recommendations
3. trending_analysis
4. patient_specific_care_plan
5. medication_optimization
6. follow_up_intelligence
7. patient_education_context
8. care_gaps
9. outcomes_prediction
10. guideline_compliance
11. quality_metrics

## Instructions:

### Step 1: For EACH collection, query the database
Use MCP MongoDB tool:
```
mcp__MongoDB-IntelliCare__find
  database: intellicare_practice_yale
  collection: clinical_decision_support (replace with each collection name)
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
- ClinicalDecisionSupportTemplate.jsx
- IntelligentRecommendationsTemplate.jsx
- TrendingAnalysisTemplate.jsx
- PatientSpecificCarePlanTemplate.jsx
- MedicationOptimizationTemplate.jsx
- FollowUpIntelligenceTemplate.jsx
- PatientEducationContextTemplate.jsx
- CareGapsTemplate.jsx
- OutcomesPredictionTemplate.jsx
- GuidelineComplianceTemplate.jsx
- QualityMetricsTemplate.jsx

Working directory: /home/erangross/Development/IntelliCare/apps/frontend-vite/src/components/artifact/pdf-templates/
