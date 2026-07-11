# Task: Add Bar Chart Visualization to insomnia_assessment

## Status: PENDING

## Template Information
- **Collection:** insomnia_assessment
- **Priority:** Tier 4 - Sleep Studies
- **Score Fields:** 2 insomnia/sleepiness scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| insomniaSeverityIndex | ISI score | 0-28 |
| epworthSleepinessScale | ESS daytime sleepiness | 0-24 |

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
- ISI interpretation:
  - 0-7: No clinically significant insomnia
  - 8-14: Subthreshold insomnia
  - 15-21: Moderate insomnia
  - 22-28: Severe insomnia
- ESS: 0-10 (normal), 11+ (excessive sleepiness)

## Notes
- Focused insomnia assessment
- Quick screening tool
- Good for tracking treatment response
