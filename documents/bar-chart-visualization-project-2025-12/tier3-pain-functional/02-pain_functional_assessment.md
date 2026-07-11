# Task: Add Bar Chart Visualization to pain_functional_assessment

## Status: PENDING

## Template Information
- **Collection:** pain_functional_assessment
- **Priority:** Tier 3 - Pain & Functional
- **Score Fields:** 4 pain and functional scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| painIntensityScore | Pain intensity | 0-10 |
| painInterferenceScore | Pain interference | 0-10 |
| catastrophizingScore | Catastrophizing | 0-52 |
| functionalImpactScore | Functional impact | Variable |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- Pain scores 0-10 need scaling to 0-100
- Catastrophizing score has different max (52)
- Higher scores = worse outcomes

## Notes
- Focused pain functional assessment
- Useful for disability evaluation
- Tracks pain impact on daily life
