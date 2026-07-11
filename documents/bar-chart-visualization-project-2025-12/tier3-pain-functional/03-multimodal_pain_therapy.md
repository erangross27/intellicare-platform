# Task: Add Bar Chart Visualization to multimodal_pain_therapy

## Status: PENDING

## Template Information
- **Collection:** multimodal_pain_therapy
- **Priority:** Tier 3 - Pain & Functional
- **Score Fields:** 5 pain and mental health scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| dischargePainScore | Pain at discharge | 0-10 |
| functionalImpairmentScore | Functional impairment | Variable |
| catastrophizingScore | Pain catastrophizing | 0-52 |
| depressionScreeningScore | Depression screening | 0-27 (PHQ-9) |
| anxietyScreeningScore | Anxiety screening | 0-21 (GAD-7) |

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
- Combines pain and mental health scores
- Depression/anxiety scores have clinical thresholds
- Multimodal approach needs holistic visualization

## Notes
- Comprehensive pain therapy assessment
- Includes psychological components
- Important for chronic pain management
