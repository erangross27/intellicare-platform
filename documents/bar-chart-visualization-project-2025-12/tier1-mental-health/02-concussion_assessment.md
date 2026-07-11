# Task: Add Bar Chart Visualization to concussion_assessment

## Status: PENDING

## Template Information
- **Collection:** concussion_assessment
- **Priority:** Tier 1 - Mental Health & Clinical Scores
- **Score Fields:** 7 SCAT5 and cognitive scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| scat5TotalScore | SCAT5 total score | 0-100 |
| symptomSeverityScore | Symptom severity | 0-132 |
| glasgowComaScore | GCS score | 3-15 |
| immediateMemoryScore | Immediate memory | 0-15 |
| concentrationScore | Concentration tasks | 0-5 |
| delayedRecallScore | Delayed recall | 0-5 |

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
- Glasgow Coma Scale has different interpretation (15 is best)
- May need custom color coding for GCS (inverse scale)
- SCAT5 scores are critical for return-to-play decisions

## Notes
- Sports medicine critical assessment
- 7 scores provide comprehensive concussion evaluation
