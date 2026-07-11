# Task 09: Testing Checklist for Each Function

## Before Optimization
- [ ] Measure current token count
- [ ] Record response time
- [ ] Save example of full response
- [ ] Note which fields Claude actually uses

## After Optimization
- [ ] Verify token count reduced by >90%
- [ ] Confirm response time <1 second
- [ ] Test Claude can still answer questions
- [ ] Check UI still displays correctly

## Test Queries for Each Function

### listAllPatients
- "Show me the patient list"
- "How many patients do we have?"
- "List all patients"

### searchPatients
- "Find patient John Smith"
- "Search for patient with phone 555-1234"
- "Find patient with SSN 123-45-6789"

### getTodaysAppointments
- "What appointments do we have today?"
- "Show today's schedule"
- "Who's coming in today?"

### searchDocuments
- "Find lab results for John"
- "Search for X-ray documents"
- "Show recent medical documents"

### searchUsers
- "List all staff members"
- "Find Dr. Smith"
- "Show all nurses"

## Rollback Criteria
- [ ] Claude cannot find information
- [ ] UI breaks or shows errors
- [ ] Response accuracy drops below 90%
- [ ] User complaints about missing data

## Documentation Required
- [ ] Comment explaining optimization
- [ ] Note original field count
- [ ] Document token savings
- [ ] Add example of reduced response