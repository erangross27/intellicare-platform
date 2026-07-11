# Task: Add Bar Chart Visualization to mortality_risk_assessment

## Status: PENDING

## Template Information
- **Collection:** mortality_risk_assessment
- **Priority:** Tier 2 - Risk Calculators
- **Score Fields:** 4 mortality risk scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| totalRiskScore | Overall mortality risk | Variable |
| predictedMortalityPercentage | Predicted mortality % | 0-100% |
| glasgowComaScore | GCS score | 3-15 |
| functionalStatusScore | Functional status | Variable |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Risk Assessment section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- Predicted mortality percentage is already 0-100 scale
- GCS has inverse interpretation (15 is best)
- Functional status may need custom scale interpretation

## Notes
- Critical for ICU and end-of-life planning
- High clinical impact for prognostication
- Visual representation helps family discussions
