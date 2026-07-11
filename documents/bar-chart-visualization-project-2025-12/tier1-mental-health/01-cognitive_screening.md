# Task: Add Bar Chart Visualization to cognitive_screening

## Status: PENDING

## Template Information
- **Collection:** cognitive_screening
- **Priority:** Tier 1 - Mental Health & Clinical Scores
- **Score Fields:** 9 cognitive domain scores

## Score Fields to Visualize
| Field | Description | Scale |
|-------|-------------|-------|
| totalScore | Overall cognitive score | 0-30 (MMSE style) |
| orientationScore | Orientation to time/place | 0-10 |
| registrationScore | Immediate recall | 0-3 |
| attentionCalculationScore | Serial 7s or WORLD | 0-5 |
| recallScore | Delayed recall | 0-3 |
| languageScore | Naming, repetition, commands | 0-9 |
| visuospatialScore | Drawing, copying | 0-1 |
| executiveFunctionScore | Executive tasks | Variable |
| maximumPossibleScore | Max possible score | Reference |

## Implementation Steps
1. Check if template exists at `apps/frontend-vite/src/components/artifact/templates/`
2. Add extractScore() and getScoreColor() helper functions
3. Add BarChart and Legend components
4. Add CSS styles for bar charts
5. Insert chart visualization at TOP of Scores section
6. Keep existing content below for detailed view
7. Update PDF template with same visualization
8. Test with sample data

## Color Coding (Standard)
- Green (#22c55e): 80+ (Above Average)
- Blue (#3b82f6): 60-79 (Average)
- Orange (#f59e0b): 40-59 (Below Average)
- Red (#ef4444): <40 (Impaired)

## Notes
- Similar to neuropsychological_assessments pattern
- 9 domain scores make this ideal for bar chart visualization
- Cognitive screening is critical for dementia assessment
