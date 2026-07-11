# Shared Decision Making Tools

## Implementation Details
- **Service**: `sharedDecisionMakingService.js`
- **Priority**: High | **Time**: 25-35 hours
- **Dependencies**: Decision aids, patient education, outcome visualization, preference assessment

## Objective
Interactive shared decision-making platform that presents treatment options with clear risks/benefits, incorporates patient values and preferences, and facilitates collaborative treatment decisions between patients and providers.

## Key Methods
```javascript
// Shared decision making support
async generateDecisionAid(condition, treatmentOptions, context)
async assessPatientPreferences(decisionScenario, patientValues, context)
async visualizeRisksBenefits(treatmentOptions, patientProfile, context)
async facilitateDecisionConversation(decisionAid, sessionData, context)
async documentDecisionProcess(decisionId, rationale, context)
```

## API Endpoints
- `POST /shared-decisions/decision-aid` - Generate interactive decision aid
- `POST /shared-decisions/preferences` - Assess patient preferences and values
- `GET /shared-decisions/visualize/:options` - Visualize risks and benefits
- `POST /shared-decisions/facilitate` - Support decision conversation
- `PUT /shared-decisions/:id/document` - Document decision rationale

## Database Schema
**SharedDecision**: `decisionId`, `patientId`, `providerId`, `condition`, `options[]`, `preferences{}`, `finalDecision`, `rationale`, `satisfactionScore`

## Key Features
1. **Interactive Decision Aids** - Visual tools for treatment option comparison
2. **Risk Communication** - Clear, understandable risk presentation
3. **Preference Assessment** - Systematic patient values collection
4. **Option Comparison** - Side-by-side treatment option analysis
5. **Decision Documentation** - Record decision process and rationale
6. **Follow-up Assessment** - Decision satisfaction and outcome tracking

## UI Components
- `DecisionAidViewer` - Interactive treatment option explorer
- `RiskVisualization` - Graphical risk and benefit display
- `PreferenceAssessment` - Patient values and priorities questionnaire
- `OptionComparison` - Treatment alternatives comparison table
- `DecisionDocumentation` - Record decision process and reasoning

## Decision Aid Categories
**Treatment Decisions:**
- Surgery vs medical management
- Medication selection choices
- Screening test decisions
- Preventive intervention options

**Diagnostic Decisions:**
- Imaging study choices
- Genetic testing options
- Invasive vs non-invasive testing
- Watchful waiting vs immediate action

**End-of-Life Decisions:**
- Advance directive planning
- Treatment intensity preferences
- Care location decisions
- Quality vs quantity of life trade-offs

## Risk Communication Methods
**Visual Formats:**
- Icon arrays (100 person diagrams)
- Bar charts and graphs
- Natural frequency representations
- Pictographs and infographics

**Numerical Presentations:**
- Absolute risk differences
- Number needed to treat/harm
- Confidence intervals
- Time-to-event probabilities

## Preference Assessment Tools
**Values Clarification:**
- Treatment goal prioritization
- Risk tolerance assessment
- Quality of life preferences
- Lifestyle impact considerations

**Decision Support:**
- What matters most to you exercises
- Trade-off scenarios
- Preference-sensitive decisions
- Cultural and religious considerations

## Integration Points
- **Clinical Decision Support** - Integrate with treatment recommendations
- **Patient Portal** - Home-based decision aid access
- **Provider Workflow** - Seamless consultation integration
- **Outcome Tracking** - Monitor decision satisfaction and regret

## Success Criteria
- [ ] Interactive decision aids for 50+ common clinical decisions
- [ ] Patient-friendly risk communication and visualization
- [ ] Systematic preference assessment and documentation
- [ ] Improved patient satisfaction and reduced decision regret