# Task: Add Bar Chart Visualization to malnutrition_risk_assessment

## Status: PENDING

## Template Information
- **Collection:** malnutrition_risk_assessment
- **Priority:** Tier 5 - Specialized
- **Score Fields:** albuminLevel, bodyMassIndex, totalRiskScore, weightLossPercentage

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Insert chart visualization at relevant section
5. Update PDF template if needed

## Notes
- Follow neuropsychological_assessments pattern (commit 33d74a93)
- Apply standard color coding unless score has inverse interpretation
