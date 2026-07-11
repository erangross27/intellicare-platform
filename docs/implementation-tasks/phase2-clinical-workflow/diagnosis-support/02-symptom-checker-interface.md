# Symptom Checker Interface

## Implementation Details
- **Service**: `symptomCheckerService.js`
- **Priority**: High | **Time**: 20-30 hours
- **Dependencies**: Symptom database, AI diagnosis engine, patient interface

## Objective
Interactive symptom checker interface for patients and providers with guided symptom collection, severity assessment, and preliminary diagnosis suggestions with appropriate triage recommendations.

## Key Methods
```javascript
// Symptom collection and analysis
async startSymptomAssessment(patientId, context)
async collectSymptomDetails(symptomId, characteristics, context)
async assessSymptomSeverity(symptoms, patientProfile, context)
async generateTriageRecommendation(symptoms, severity, context)
async provideSelfCareGuidance(minorSymptoms, context)
```

## API Endpoints
- `POST /symptom-checker/start` - Begin symptom assessment
- `PUT /symptom-checker/:id/symptoms` - Add/update symptoms
- `POST /symptom-checker/assess` - Analyze symptom collection
- `GET /symptom-checker/:id/recommendations` - Get triage recommendations
- `GET /symptom-checker/self-care/:symptom` - Self-care guidance

## Database Schema
**SymptomAssessment**: `assessmentId`, `patientId`, `symptoms[]`, `severity`, `duration`, `triageLevel`, `recommendations[]`, `selfCareAdvice[]`

## Key Features
1. **Guided Collection** - Step-by-step symptom entry with smart questions
2. **Severity Scoring** - Standardized severity assessment (1-10 scale)
3. **Duration Tracking** - When symptoms started and progression
4. **Associated Symptoms** - Related symptom identification
5. **Triage Levels** - Emergency, urgent, routine, self-care categories
6. **Multilingual** - Hebrew and English symptom descriptions

## UI Components
- `SymptomSelector` - Searchable symptom selection interface
- `SeveritySlider` - Visual severity rating (1-10)
- `DurationPicker` - Symptom onset and duration selection
- `TriageAlert` - Color-coded urgency recommendations
- `SelfCareGuide` - Self-care instructions for minor symptoms

## Triage Categories
- **🚨 Emergency** - Call 911/Magen David Adom immediately
- **⚡ Urgent** - Seek medical care within 2-4 hours
- **📋 Routine** - Schedule appointment within 1-2 weeks
- **🏠 Self-Care** - Home management with monitoring advice

## Integration Points
- **Differential Diagnosis** - Feed symptoms into AI diagnosis engine
- **Appointment Booking** - Direct scheduling based on triage level
- **Patient Portal** - Access from patient mobile/web interface
- **Provider Dashboard** - Review patient self-assessments

## Success Criteria
- [ ] Complete symptom assessment in <5 minutes
- [ ] Accurate triage recommendations (95%+ appropriate urgency)
- [ ] Multi-language support with medical term translation
- [ ] Integration with emergency services for critical symptoms