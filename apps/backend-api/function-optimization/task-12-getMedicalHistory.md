# Task 12: Optimize getMedicalHistory Function

## Current Issue
- Returns FULL medical history with complete notes
- Each entry can be 1,000+ characters
- 100 entries = 100,000+ characters = 25,000+ tokens!
- Includes doctor's full notes, procedures, diagnoses

## Location
- File: `services/agentServiceV4.js`
- Line: ~15017

## Current Return Structure
```javascript
{
  success: true,
  data: [
    {
      _id, date, type,
      fullNotes: "Patient presented with... [2000 chars]",
      diagnosis: "Detailed diagnosis... [500 chars]",
      treatment: "Full treatment plan... [1000 chars]",
      procedures: [...all procedures],
      medications: [...all prescribed],
      followUp: "Detailed follow-up... [500 chars]",
      // More fields
    }
    // × 100 entries!
  ]
}
```

## Smart Timeline Optimization
```javascript
// Recent history (default)
if (!params.timeframe) {
  return last 10 entries with summaries only
}

// Date range requested
if (params.dateFrom || params.dateTo) {
  return entries in range with summaries
}

// Specific condition history
if (params.condition) {
  return only entries mentioning that condition
}

// For each entry, return:
{
  _id: entry._id,
  date: entry.date,
  type: entry.type,
  provider: entry.providerName,
  summary: entry.fullNotes.substring(0, 100) + '...',
  hasDiagnosis: !!entry.diagnosis,
  hasPrescription: !!entry.medications?.length,
  hasLabResults: !!entry.labResults
}
```

## Smart Pagination
```javascript
return {
  success: true,
  data: optimizedEntries, // Max 20 at a time
  pagination: {
    total: allEntries.length,
    returned: 20,
    hasMore: true,
    oldest: oldestDate,
    newest: newestDate
  },
  summary: {
    totalVisits: allEntries.length,
    timespan: `${yearsOfHistory} years`,
    commonConditions: top3Conditions
  }
}
```

## Context-Based Detail Level
```javascript
// If asking about specific visit
if (params.visitId) {
  return FULL details for that visit only
}

// If reviewing history
if (context.includes('review') || context.includes('summary')) {
  return condensed timeline view
}

// If looking for specific info
if (context.includes('prescription') || context.includes('medication')) {
  return entries with medications highlighted
}
```

## Expected Result
- Default: 500 tokens for 10 recent entries
- Full history: 2,000 tokens with pagination
- Specific query: 200 tokens with targeted data