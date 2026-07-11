# Task: Add Bar Chart Visualization to depression_screening

## Status: PENDING

## Template Information
- **Collection:** depression_screening
- **Priority:** Tier 1 - Mental Health & Clinical Scores
- **Score Fields:** PHQ-9 based scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| phq9Score | PHQ-9 Depression Score | 0-27 |
| (other PHQ-9 item scores) | Individual question scores | 0-3 each |

## Implementation Steps
1. Template already exists (Session 05ee9edc)
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Special Considerations
- PHQ-9 has INVERSE interpretation (higher = more depressed)
- Severity levels:
  - 0-4: Minimal
  - 5-9: Mild
  - 10-14: Moderate
  - 15-19: Moderately Severe
  - 20-27: Severe
- May need custom color coding based on clinical thresholds

## Notes
- High-volume screening template
- Used frequently in primary care
- Visual representation critical for quick severity assessment
