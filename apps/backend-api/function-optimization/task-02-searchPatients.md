# Task 02: Optimize searchPatients Function

## Current Issue
- Returns FULL patient records for search results
- Includes entire medical history, conditions, medications
- Overwhelming token count for Claude

## Location
- File: `services/agentServiceV4.js`
- Line: ~13691
- Used by: findPatient, searchPatientsByName

## Current Return Structure
```javascript
{
  success: true,
  data: [/* Full patient objects with medical history */],
  count: results.length,
  searchQuery: query
}
```

## Required Optimization
Return search-relevant fields only:
```javascript
{
  _id: patient._id,
  firstName: patient.firstName,
  lastName: patient.lastName,
  nationalId: patient.nationalId,
  matchedField: /* The field that matched search */,
  relevanceScore: /* Optional: search relevance */
}
```

## Implementation Steps
1. Map results to minimal structure
2. Include which field matched the search
3. Sort by relevance if multiple matches
4. Preserve search highlighting if exists

## Expected Result
- Token reduction: 90%+
- Better search result clarity
- Faster Claude processing