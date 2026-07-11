# Task: Add Bar Chart Visualization to sleep_study

## Status: PENDING

## Template Information
- **Collection:** sleep_study
- **Priority:** Tier 4 - Sleep Studies
- **Score Fields:** 7 polysomnography indices

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| apneaHypopneaIndex | AHI events/hour | 0-100+ |
| oxygenDesaturationIndex | ODI events/hour | 0-100+ |
| centralApneaIndex | Central apnea index | 0-50+ |
| obstructiveApneaIndex | Obstructive apnea index | 0-50+ |
| arousalIndex | Arousals/hour | 0-50+ |
| periodicLimbMovementIndex | PLMI | 0-50+ |
| snoringPercentage | Snoring % of sleep | 0-100% |

## Implementation Steps
1. Check if template exists
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of PSG Results section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- All indices have similar interpretation (higher = worse)
- PLMI: 0-15 (normal), 15+ (PLMD)
- Snoring percentage: contextual interpretation

## Notes
- Core polysomnography results
- 7 objective sleep metrics
- Critical for sleep disorder diagnosis
