# Task: Add Bar Chart Visualization to sleep_apnea_management

## Status: PENDING

## Template Information
- **Collection:** sleep_apnea_management
- **Priority:** Tier 4 - Sleep Studies
- **Score Fields:** 7 sleep apnea metrics

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| apneaHypopneaIndex | AHI events/hour | 0-100+ |
| epworthSleepinessScore | ESS daytime sleepiness | 0-24 |
| oxygenDesaturationIndex | ODI events/hour | 0-100+ |
| centralApneaIndex | Central apnea index | 0-50+ |
| obstructiveApneaIndex | Obstructive apnea index | 0-50+ |
| arousalIndex | Arousals/hour | 0-50+ |
| remSleepPercentage | REM sleep % | 0-100% |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Sleep Metrics section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- AHI severity:
  - 0-5: Normal
  - 5-15: Mild
  - 15-30: Moderate
  - 30+: Severe
- ESS: 0-10 (normal), 11+ (excessive sleepiness)
- REM percentage: 20-25% is normal

## Notes
- 7 comprehensive sleep metrics
- Critical for CPAP management
- Excellent visualization candidate
