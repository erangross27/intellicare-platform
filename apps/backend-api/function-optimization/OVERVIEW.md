# Function Optimization Tasks

## Problem Statement
Claude AI receives 34,095 tokens from list functions, causing 15-20 second delays. Functions return FULL data objects when only essential fields are needed.

## Goal
Reduce token count by 95% (from 34,095 to <1,000) by returning only essential fields for list/search operations.

## Identified Functions Requiring Optimization

### Patient Functions (High Priority)
1. `listAllPatients` - Returns full patient records
2. `searchPatients` - Returns full patient records
3. `searchPatientsByName` - Returns full patient records
4. `searchPatientsByCondition` - Returns full patient records with conditions
5. `findPatient` - Returns full patient record

### Appointment Functions (High Priority)
6. `getTodaysAppointments` - Returns full appointment details
7. `getUpcomingAppointments` - Returns full appointment details
8. `findAvailableSlots` - Returns full slot information
9. `listAppointments` - Returns full appointment records

### Document Functions (Medium Priority)
10. `searchDocuments` - Returns full document content
11. `listDocuments` - Returns full document records
12. `getRecentDocuments` - Returns full documents

### User/Provider Functions (Medium Priority)
13. `searchUsers` - Returns full user profiles
14. `searchProviders` - Returns full provider profiles
15. `getAllUsers` - Returns full user records
16. `getProviders` - Returns full provider records

### Medical Record Functions (Low Priority)
17. `listMedicalRecords` - Returns full medical records
18. `searchMedicalRecords` - Returns full medical records
19. `listPrescriptions` - Returns full prescription details
20. `listLabResults` - Returns full lab results

### Chat/History Functions (Low Priority)
21. `searchChatHistory` - Returns full chat messages
22. `getChatSessions` - Returns full session data

## Optimization Strategy

### For List Operations
Return only:
- `_id` (for reference)
- Primary identifier (name, title, etc.)
- Secondary identifier (date, type, status)
- Max 5-7 fields total

### For Search Operations
Return only:
- Matching fields
- Essential context
- Navigation info (for drill-down)

### Data Structure Pattern
```javascript
// BEFORE: 500+ chars per item
{
  _id, firstName, lastName, middleName, ssn, dateOfBirth,
  gender, email, phone, alternativePhone, address, city,
  state, zipCode, country, insurance, medicalHistory,
  allergies, medications, conditions, notes, createdAt,
  updatedAt, lastVisit, nextAppointment, provider, ...
}

// AFTER: 50-100 chars per item
{
  _id, firstName, lastName, ssn, phone, age
}
```

## Implementation Phases

### Phase 1: Critical Functions (Immediate)
- Fix top 5 most-used list functions
- Test token reduction
- Measure performance improvement

### Phase 2: All List Functions (Day 1)
- Apply pattern to all list/search functions
- Standardize response format
- Add metadata about truncation

### Phase 3: Smart Context (Day 2)
- Add context-aware field selection
- Include fields mentioned in query
- Preserve essential relationships

## Success Metrics
- Token count: <1,000 per response
- Response time: <1 second
- Claude accuracy: Maintained or improved
- User experience: No degradation