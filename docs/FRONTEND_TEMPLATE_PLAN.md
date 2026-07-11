# Frontend Template Implementation Plan
**Date:** October 10, 2025
**Based on:** Actual database structure from intellicare_practice_yale

## Data Structure Analysis Complete ✅

I've examined the actual MongoDB documents and identified the exact fields for each collection.

## Template Priority

### TIER 1: AI Clinical Insights (7 templates) - COMPLEX, HIGH VALUE
These have rich nested data structures and need specialized rendering:

1. **ClinicalDecisionSupportDocument.jsx**
   - Fields: riskAssessment (with riskFactors array), redFlags array, drugInteractions array, contraindications array
   - Complexity: HIGH - nested objects with severity levels, color-coded alerts

2. **IntelligentRecommendationsDocument.jsx**
   - Fields: immediate array, shortTerm array, longTerm array, preventive array
   - Complexity: HIGH - timeline-based recommendations, priority levels

3. **TrendingAnalysisDocument.jsx**
   - Fields: labTrends array, vitalSignsTrends array, diseaseProgression object
   - Complexity: HIGH - trend charts, graphs, timeline visualization

4. **PatientCarePlanDocument.jsx**
   - Fields: tailoredInterventions array, lifestyleModifications array, comorbidityManagement object
   - Complexity: HIGH - comprehensive care plan with outcome metrics

5. **FollowUpIntelligenceDocument.jsx**
   - Fields: deadlines array, prioritization array, coordinationNeeds array
   - Complexity: MEDIUM - deadline tracking, priority matrix

6. **OutcomesPredictionsDocument.jsx**
   - Fields: prognosis (text), modifiableFactors array, expectedOutcomes (text)
   - Complexity: MEDIUM - long narrative text with key factors

7. **GuidelineComplianceDocument.jsx**
   - Fields: guidelines array (with compliance, recommendations, gaps)
   - Complexity: MEDIUM - compliance checklist, gap analysis

### TIER 2: Surgical & Mental Health (2 templates) - MEDIUM COMPLEXITY

8. **IntraoperativeRecordsDocument.jsx**
   - Fields: procedureName, procedureType, provider, findings, technique, complications, outcome
   - Complexity: MEDIUM - surgical documentation, timeline

9. **PsychosocialAssessmentsDocument.jsx**
   - Fields: mentalStatus, mood, affect, thoughtProcess, livingArrangement, socialSupport, riskLevel
   - Complexity: MEDIUM - mental health assessment, risk indicators

### TIER 3: Clinical Operations (6 templates) - SIMPLE TO MEDIUM

10. **RemindersDocument.jsx**
    - Fields: reminder text, dueDate, status, priority
    - Complexity: LOW - simple list with dates

11. **QualityMetricsDocument.jsx**
    - Fields: metrics data, scores, benchmarks
    - Complexity: LOW - metrics display, charts

12. **HistoryPresentIllnessDocument.jsx**
    - Fields: narrative text, onset, duration, symptoms
    - Complexity: LOW - narrative text display

13. **CareGapsDocument.jsx**
    - Fields: gap description, severity, recommendation, status
    - Complexity: MEDIUM - gap tracking, action items

14. **CostTrackingDocument.jsx**
    - Fields: totalCosts, dailyCosts, monthlyCosts, userCosts
    - Complexity: LOW - cost display, simple charts

15. **AdministrativeDataDocument.jsx**
    - Fields: mrn, insurance, primaryCareProvider, emergencyContact, codeStatus, advancedDirectives
    - Complexity: LOW - simple key-value display

### TIER 4: Medical Data (17 collections) - VARIES

16. **RiskFactorsDocument.jsx**
    - Fields: factor, category, severity, dateIdentified, status
    - Complexity: LOW - simple list with severity indicators

17. **ImagingReportsDocument.jsx**
    - Fields: imagingType, bodyPart, findings, impression, technique, contrast, recommendations
    - Complexity: MEDIUM - radiology report format

18. **MedicationOptimizationDocument.jsx**
    - Fields: costAnalysis, simplificationOpportunities, adherenceRisk
    - Complexity: MEDIUM - optimization recommendations

19. **MedicalProceduresDocument.jsx**
    - Fields: procedureName, procedureType, provider, findings, technique, complications, outcome
    - Complexity: MEDIUM - procedure documentation

...and 13 more

## Implementation Strategy

### Option 1: Create ALL 32 Templates (EXHAUSTIVE)
**Pros:** Complete coverage, perfect customization
**Cons:** ~32 files × 200 lines = 6,400 lines of code, 2-3 days work
**Recommendation:** ❌ Too much work

### Option 2: Create Generic + Specialized (SMART) ✅
**Approach:**
1. Create 7 specialized templates for AI Clinical Insights (TIER 1)
2. Create 1 generic template that handles TIER 2-4 smartly

**Generic Template Intelligence:**
- Auto-detect field types (text, arrays, objects, dates)
- Render arrays as lists
- Render nested objects as sections
- Format dates automatically
- Color-code by field names (redFlags = red, recommendations = green)

**Total Work:** ~7 templates × 300 lines + 1 smart generic × 500 lines = ~2,600 lines

## Recommended Action Plan

### Phase 1: Create 7 AI Clinical Insights Templates (HIGH VALUE)
These are the most important - they contain AI-generated clinical insights that need beautiful visualization:

1. ClinicalDecisionSupportDocument.jsx - Risk alerts, drug interactions
2. IntelligentRecommendationsDocument.jsx - Action timeline
3. TrendingAnalysisDocument.jsx - Trend charts
4. PatientCarePlanDocument.jsx - Care plan roadmap
5. FollowUpIntelligenceDocument.jsx - Deadline tracker
6. OutcomesPredictionsDocument.jsx - Prognosis display
7. GuidelineComplianceDocument.jsx - Compliance checklist

### Phase 2: Enhance Generic Fallback (SMART RENDERING)
Update AIDocumentRenderer.jsx's `renderGenericDocument()` to be SMARTER:
- Auto-detect nested structures
- Render arrays as expandable sections
- Format dates/times properly
- Color-code by severity/priority
- Show patient demographics at top

This handles all remaining 25 collections beautifully without custom templates.

### Phase 3: Add More Specialized Templates As Needed
When users request specific formatting for a collection, create dedicated template.

## Files to Create (Phase 1)

```
apps/frontend-vite/src/components/artifact/templates/
├── ClinicalDecisionSupportDocument.jsx
├── ClinicalDecisionSupportDocument.css
├── IntelligentRecommendationsDocument.jsx
├── IntelligentRecommendationsDocument.css
├── TrendingAnalysisDocument.jsx
├── TrendingAnalysisDocument.css
├── PatientCarePlanDocument.jsx
├── PatientCarePlanDocument.css
├── FollowUpIntelligenceDocument.jsx
├── FollowUpIntelligenceDocument.css
├── OutcomesPredictionsDocument.jsx
├── OutcomesPredictionsDocument.css
├── GuidelineComplianceDocument.jsx
└── GuidelineComplianceDocument.css
```

**Total:** 7 JSX files + 7 CSS files = 14 files

## Next Steps

1. Create 7 AI Clinical Insights templates
2. Update AIDocumentRenderer.jsx routing
3. Enhance generic fallback renderer
4. Test with real data

Should I proceed with creating the 7 AI Clinical Insights templates?
