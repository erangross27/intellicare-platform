# Task: Add Bar Chart Visualization to bleeding_risk_assessment

## Status: PENDING

## Template Information
- **Collection:** bleeding_risk_assessment
- **Priority:** Tier 2 - Risk Calculators
- **Score Fields:** 2 bleeding/anemia metrics

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| bleedingRiskScore | Bleeding risk score | 0-10+ |
| hemoglobinLevel | Hemoglobin level | g/dL |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Assessment section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- Hemoglobin is a lab value with reference ranges:
  - Male: 13.5-17.5 g/dL (normal)
  - Female: 12.0-16.0 g/dL (normal)
- Bleeding risk score interpretation varies by tool (HAS-BLED, ATRIA, etc.)

## Notes
- Important for anticoagulation decisions
- Balance between thrombosis and bleeding risk
- Lab values may need percentage-of-normal calculation
