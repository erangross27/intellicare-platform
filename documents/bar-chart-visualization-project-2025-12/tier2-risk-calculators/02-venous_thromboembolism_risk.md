# Task: Add Bar Chart Visualization to venous_thromboembolism_risk

## Status: PENDING

## Template Information
- **Collection:** venous_thromboembolism_risk
- **Priority:** Tier 2 - Risk Calculators
- **Score Fields:** 5 VTE risk scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| wellsScore | Wells DVT/PE score | 0-12+ |
| paduaPredictionScore | Padua prediction score | 0-20+ |
| capriniScore | Caprini VTE risk | 0-10+ |
| bleedingRiskScore | Bleeding risk | 0-10+ |
| ddimerLevel | D-dimer level | ng/mL |

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
- Wells score: <2 (low), 2-6 (moderate), >6 (high)
- Caprini score: 0-1 (low), 2 (moderate), 3-4 (high), 5+ (highest)
- D-dimer is a lab value, not a score (may need different visualization)

## Notes
- Critical for DVT/PE risk stratification
- 5 complementary risk scores
- Helps with anticoagulation decisions
