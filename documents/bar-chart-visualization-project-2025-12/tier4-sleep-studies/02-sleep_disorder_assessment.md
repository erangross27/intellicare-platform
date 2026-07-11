# Task: Add Bar Chart Visualization to sleep_disorder_assessment

## Status: PENDING

## Template Information
- **Collection:** sleep_disorder_assessment
- **Priority:** Tier 4 - Sleep Studies
- **Score Fields:** 6 sleep disorder scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| epworthSleepinessScore | ESS daytime sleepiness | 0-24 |
| pittsburghSleepQualityIndex | PSQI sleep quality | 0-21 |
| stopBangScore | STOP-BANG OSA risk | 0-8 |
| apneaHypopneaIndex | AHI events/hour | 0-100+ |
| oxygenDesaturationIndex | ODI events/hour | 0-100+ |
| mallampatiScore | Airway classification | 1-4 |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Assessment Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- PSQI: 0-5 (good), 6+ (poor sleep quality)
- STOP-BANG: 0-2 (low), 3-4 (intermediate), 5-8 (high OSA risk)
- Mallampati: 1-2 (low risk), 3-4 (high risk)

## Notes
- Comprehensive sleep disorder screening
- Combines subjective and objective measures
- Important for sleep medicine referral
