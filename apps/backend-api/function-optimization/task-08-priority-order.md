# Task 08: Implementation Priority Order

## Immediate (Fix NOW - Causing 20-second delays)
1. **listAllPatients** - Most used, biggest impact
2. **getTodaysAppointments** - Called frequently
3. **searchPatients** - Core functionality

## Day 1 (High Token Count)
4. **searchDocuments** - Returns base64 data!
5. **listMedicalRecords** - Large text content
6. **searchMedicalRecords** - Full medical notes

## Day 2 (Medium Priority)
7. **searchUsers** - Security risk with passwords
8. **searchProviders** - Returns schedules
9. **listPrescriptions** - Detailed med info
10. **listLabResults** - All test values

## Day 3 (Lower Priority)
11. **findAvailableSlots** - Calendar data
12. **searchChatHistory** - Message content
13. **getUpcomingAppointments** - Future schedules
14. **getPatientsForFollowUp** - Condition tracking

## Measurement After Each Fix
- Token count before/after
- Response time before/after
- Claude accuracy maintained?
- User experience impact?

## Success Criteria
- Phase 1: <5 second responses
- Phase 2: <2 second responses
- Phase 3: <1 second responses
- Final: 95% token reduction overall