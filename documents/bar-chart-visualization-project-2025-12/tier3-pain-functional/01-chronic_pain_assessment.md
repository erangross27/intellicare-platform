# Task: Add Bar Chart Visualization to chronic_pain_assessment

## Status: PENDING

## Template Information
- **Collection:** chronic_pain_assessment
- **Priority:** Tier 3 - Pain & Functional
- **Score Fields:** 6 pain and functional scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| painIntensityScore | Current pain intensity | 0-10 |
| worstPainScore | Worst pain level | 0-10 |
| averagePainScore | Average pain level | 0-10 |
| oswestryDisabilityIndex | ODI disability | 0-100% |
| painCatastrophizingScale | PCS score | 0-52 |
| functionalImpairmentScore | Functional impact | Variable |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Pain Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- Pain scores 0-10 need scaling to 0-100 for bar chart
- ODI already percentage
- PCS: 0-13 (low), 14-26 (moderate), 27+ (high)
- Higher scores = worse for all these measures

## Notes
- 6 comprehensive pain metrics
- Excellent for tracking pain over time
- High clinical value for pain management
