# Task: Add Bar Chart Visualization to opioid_risk_assessment

## Status: PENDING

## Template Information
- **Collection:** opioid_risk_assessment
- **Priority:** Tier 3 - Pain & Functional
- **Score Fields:** 3 opioid and pain scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| opioidRiskToolScore | ORT score | 0-26 |
| numericalPainScore | Pain score | 0-10 |
| functionalImpairmentScore | Functional impairment | Variable |

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
- ORT score interpretation:
  - 0-3: Low risk
  - 4-7: Moderate risk
  - 8+: High risk
- Critical for opioid prescribing decisions

## Notes
- Important for opioid epidemic response
- Risk stratification for prescribing
- Helps guide monitoring intensity
