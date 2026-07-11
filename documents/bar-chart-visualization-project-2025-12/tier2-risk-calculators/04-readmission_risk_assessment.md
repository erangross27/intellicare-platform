# Task: Add Bar Chart Visualization to readmission_risk_assessment

## Status: PENDING

## Template Information
- **Collection:** readmission_risk_assessment
- **Priority:** Tier 2 - Risk Calculators
- **Score Fields:** 4 readmission risk scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| laceIndexScore | LACE index | 0-19 |
| hospitalScore | HOSPITAL score | 0-13 |
| charlsonComorbidityIndex | CCI | 0-37 |
| functionalStatusScore | Functional status | Variable |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Risk Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- LACE: 0-4 (low), 5-9 (moderate), 10+ (high)
- HOSPITAL: 0-4 (low), 5-6 (intermediate), 7+ (high)
- Charlson: Higher = more comorbidities

## Notes
- Critical for discharge planning
- Value-based care metric
- Helps target post-discharge resources
