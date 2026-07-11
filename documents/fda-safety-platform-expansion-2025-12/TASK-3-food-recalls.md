# TASK 3: Food Recalls

## Status: NOT STARTED

## Overview
Alert doctors when food products are recalled that may affect patients with specific allergies or dietary restrictions.

## API Details
- **Endpoint:** `https://api.fda.gov/food/enforcement.json`
- **Documentation:** https://open.fda.gov/apis/food/enforcement/

## Patient Data Sources
Collections with allergy/dietary information:
- `allergies` - Patient allergies (food allergies like peanuts, shellfish)
- `dietary_interventions` - Dietary restrictions
- `nutritional_assessment` - Nutrition data

## Use Cases
1. FDA recalls peanut butter due to Salmonella
2. System checks patients with peanut allergy
3. Alert: "Patient has peanut allergy - may have consumed recalled product"

OR

1. FDA recalls infant formula
2. System checks patients who are infants/on formula
3. Alert to pediatrician

## Implementation Steps

### Backend

1. [ ] Add `checkForFoodRecalls()` function
   - Fetch from `/food/enforcement.json`
   - Store in `food_safety_alerts` collection

2. [ ] Add `extractFoodAllergens(productDescription)` function
   - Parse allergens from FDA descriptions
   - Match common allergens (peanuts, tree nuts, milk, eggs, wheat, soy, fish, shellfish)

3. [ ] Add `findPatientsWithFoodAllergy(allergen)` function
   - Query allergies collection
   - Find patients with matching allergies

### Frontend

4. [ ] Create `FoodRecallAlerts.js` component
   - Show only if patient has relevant allergy
   - Lower priority than drug/device recalls

## API Response Fields
```json
{
  "product_description": "Peanut Butter Cups",
  "reason_for_recall": "Potential Salmonella contamination",
  "classification": "Class I",
  "recalling_firm": "Acme Foods",
  "distribution_pattern": "Nationwide"
}
```

## Priority: LOW
- Less directly relevant to medical practice
- Harder to match (food names vs patient data)
- Consider implementing only if we have robust allergy data

## Questions to Answer First
1. Do we have food allergy data in the system?
2. How detailed is our allergy data (just "peanut allergy" or specific products)?
3. Is this within scope for a medical platform?

## Estimated Effort
- Backend: 2 hours
- Frontend: 1 hour
- Testing: 1 hour
