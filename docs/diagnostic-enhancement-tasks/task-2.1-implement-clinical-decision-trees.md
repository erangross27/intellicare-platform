# Task 2.1: Implement Interactive Clinical Decision Trees

## Status: Pending
**Estimated Time**: 2-3 days  
**Priority**: High  
**Category**: AI Intelligence Layer  

## Description
Create interactive clinical decision trees that guide doctors through evidence-based diagnostic pathways, integrating with the existing Gemini function calling diagnostic system.

## Technical Requirements

### Core Functionality
```javascript
// Extend existing diagnosticServiceNew.js
const clinicalDecisionTreeFunction = {
  name: "generate_clinical_decision_tree",
  parameters: {
    primarySymptoms: String,
    patientDemographics: Object,
    currentFindings: Array,
    nextSteps: Array,
    confidenceThresholds: Object
  }
}
```

### Integration Points
- **Existing**: `backend/services/diagnosticServiceNew.js` - Add decision tree function calling
- **Existing**: `backend/routes/diagnosis.js` - Add new endpoint `/api/diagnosis/decision-tree`
- **Frontend**: Extend diagnostic interface with interactive tree visualization

### Database Schema Extensions
```javascript
// Add to existing patient analyses array
analyses: [{
  // ... existing fields
  decisionTreePath: [{
    step: Number,
    question: String,
    answer: String,
    confidence: Number,
    nextSteps: [String]
  }],
  clinicalPathway: String,
  evidenceLevel: String
}]
```

## Implementation Steps

### Phase 1: Backend Function Integration
1. **Extend DiagnosticServiceNew** (0.5 days)
   - Add clinical decision tree function to existing function calling setup
   - Integrate with current comprehensive diagnosis flow
   - Maintain existing Hebrew/English language support

2. **Create Decision Tree Route** (0.5 days)
   - Add `/api/diagnosis/decision-tree` endpoint to existing diagnosis.js
   - Integrate with current patient context and medical history
   - Return structured tree data compatible with existing frontend

### Phase 2: Frontend Integration  
3. **Interactive Tree Component** (1 day)
   - Create Vue.js component for decision tree visualization
   - Integrate with existing diagnostic interface
   - Support Hebrew medical terminology display

4. **Clinical Pathway Tracking** (0.5 days)
   - Track decision paths in existing patient analyses array
   - Display pathway history in patient medical timeline
   - Export pathway reports for clinical documentation

### Phase 3: Clinical Evidence Integration
5. **Evidence-Based Pathways** (0.5 days)
   - Integrate Israeli medical guidelines where applicable
   - Support קופת חולים specific protocols
   - Add confidence scoring for each decision point

## Files to Modify
- `backend/services/diagnosticServiceNew.js` - Add decision tree function
- `backend/routes/diagnosis.js` - Add decision tree endpoint  
- `frontend-vite/src/components/DiagnosticInterface.vue` - Add tree component
- `backend/models/PatientSchemaFactory.js` - Extend analyses schema (if needed)

## Integration with Existing System
- **Builds on**: Existing Gemini function calling in diagnosticServiceNew.js
- **Enhances**: Current symptom analysis with structured decision support
- **Maintains**: All existing patient data structure and practice multi-tenancy
- **Preserves**: Hebrew language support and קופת חולים integration

## Success Criteria
- [ ] Decision trees integrate seamlessly with existing diagnostic flow
- [ ] Clinical pathways are tracked in patient medical history
- [ ] Hebrew medical terminology is properly supported
- [ ] Evidence-based recommendations align with Israeli medical standards
- [ ] Decision confidence scoring helps clinical decision-making

## Dependencies
- Existing Gemini API integration
- Current patient schema structure  
- Established practice context and authentication
- Hebrew medical terminology database

## Notes
This enhancement builds directly on your existing diagnostic foundation rather than replacing it, adding structured clinical decision support to complement the current AI-powered diagnosis system.