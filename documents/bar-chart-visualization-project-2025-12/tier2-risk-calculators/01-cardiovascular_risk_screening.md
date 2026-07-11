# Task: Add Bar Chart Visualization to cardiovascular_risk_screening

## Status: PENDING

## Template Information
- **Collection:** cardiovascular_risk_screening
- **Priority:** Tier 2 - Risk Calculators
- **Score Fields:** 6 cardiovascular risk scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| ascvdRiskScore | ASCVD 10-year risk | 0-100% |
| framinghamRiskScore | Framingham 10-year risk | 0-100% |
| reynoldsRiskScore | Reynolds risk score | 0-100% |
| coronaryCalciumScore | CAC score | 0-400+ |
| anklebrachialIndex | ABI | 0.0-1.4+ |
| bodyMassIndex | BMI | 15-50+ |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components with PERCENTAGE interpretation
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Risk Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- Risk percentages are already 0-100 scale
- Coronary Calcium Score needs different scale (0-400+)
- ABI has specific interpretation (0.9-1.3 normal)
- BMI has clinical thresholds (18.5-24.9 normal)

## Notes
- 6 different risk calculators in one template
- Excellent candidate for comparative visualization
- High clinical value for cardiovascular prevention
