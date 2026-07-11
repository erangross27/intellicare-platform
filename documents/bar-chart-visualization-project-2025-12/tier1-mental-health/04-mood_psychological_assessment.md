# Task: Add Bar Chart Visualization to mood_psychological_assessment

## Status: PENDING

## Template Information
- **Collection:** mood_psychological_assessment
- **Priority:** Tier 1 - Mental Health & Clinical Scores
- **Score Fields:** 3 mental health scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| gdsScore | Geriatric Depression Scale | 0-30 (higher = more depressed) |
| gadScore | Generalized Anxiety Disorder | 0-21 |
| phq9Score | PHQ-9 Depression | 0-27 |

## Implementation Steps
1. Template already exists (Memory 69303d702ea26ad69e241fa2)
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Scores section
6. Keep existing Scores section content below
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- These scores have INVERSE interpretation (higher = worse)
- May need custom color coding:
  - PHQ-9: 0-4 (minimal), 5-9 (mild), 10-14 (moderate), 15-19 (moderately severe), 20-27 (severe)
  - GAD-7: 0-4 (minimal), 5-9 (mild), 10-14 (moderate), 15-21 (severe)
  - GDS: 0-9 (normal), 10-19 (mild depression), 20-30 (severe depression)

## Notes
- Template already has Section Copy Buttons pattern
- Core mental health screening template
- Very high clinical value for visualization
