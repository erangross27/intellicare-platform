# Task 02: Add Missing Meeting Tools

## Priority: HIGH
## Category: Phase 1 - Wire Existing Services
## Dependencies: None

## Background

The platform has basic meeting support (schedule, get, delete) but is missing update capability and recurring meetings. Providers need to reschedule meetings, update meeting details, and set up recurring meetings (e.g., weekly team meetings, monthly case reviews).

## What Already Exists

### providerService.js
Location: `apps/backend-api/services/providerService.js`
Existing functions:
- `scheduleDoctorMeeting(meetingData)` - Creates a meeting between providers
- `getDoctorMeetings(providerId)` - Lists provider meetings
- `deleteDoctorMeetings(meetingId)` - Deletes a meeting

### Agent Tools Already Defined
- `scheduleDoctorMeeting` - In aiHelpers.js + agentServiceV4.js
- `getDoctorMeetings` - In aiHelpers.js + agentServiceV4.js
- `deleteDoctorMeetings` - In agentServiceV4.js

### Related: Busy Time Management
- `setMyBusyTime` - Block personal time
- `cancelMyBusyTime` - Remove blocked time
- `showMyBusyTimes` - View blocked times

## What Needs to Be Done

### Step 1: Add updateProviderMeeting to providerService.js
Location: `apps/backend-api/services/providerService.js`

Create a new function that:
- Accepts meetingId + update fields (date, time, location, agenda, attendees)
- Validates the meeting exists
- Validates no scheduling conflicts for new time
- Updates the meeting in the database
- Returns updated meeting

### Step 2: Add getAvailableMeetingTimes to providerService.js
Create a function that:
- Accepts two provider IDs + date range
- Checks both providers' availability (appointments + meetings + busy times)
- Returns overlapping free slots
- Uses existing availabilityService for slot checking

### Step 3: Add Recurring Meeting Support
Create functions in providerService.js:
- `createRecurringMeeting(meetingTemplate, recurrencePattern)` - Pattern: daily, weekly, biweekly, monthly
- `getRecurringMeetingSeries(seriesId)` - Get all instances
- `updateRecurringMeeting(seriesId, changes, scope)` - Scope: this instance, this and future, all
- `deleteRecurringMeetingSeries(seriesId)` - Delete entire series

Recurrence pattern should support:
- frequency: daily | weekly | biweekly | monthly
- endDate or numberOfOccurrences
- daysOfWeek (for weekly: ["monday", "wednesday"])

### Step 4: Add Tool Definitions to aiHelpers.js
Add schemas for:
- `updateProviderMeeting` - meetingId, date, time, location, agenda, attendees
- `getAvailableMeetingTimes` - provider1Id, provider2Id, startDate, endDate
- `createRecurringMeeting` - all meeting fields + frequency, endDate, daysOfWeek
- `updateRecurringMeeting` - seriesId, changes, scope (thisOnly/thisAndFuture/all)
- `deleteRecurringMeetingSeries` - seriesId

### Step 5: Add Case Routes in agentServiceV4.js
Wire the new functions to the agent's tool routing switch.

### Step 6: Update Function Group
In `claudeMedicalFunctionGroups.js`, update the meeting function group with new keywords:
- "reschedule meeting", "change meeting", "update meeting"
- "recurring meeting", "weekly meeting", "monthly meeting"
- "available meeting times", "when can we meet"

### Step 7: Test via Chat
- "Reschedule the meeting with Dr. Smith to next Tuesday at 2pm"
- "When can Dr. Jones and Dr. Smith both meet next week?"
- "Set up a recurring weekly meeting every Monday at 9am with Dr. Johnson"
- "Cancel the recurring Monday meeting series"
- "Update just this week's meeting to 10am instead"

## Files to Modify
1. `apps/backend-api/services/providerService.js` - New functions
2. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
3. `apps/backend-api/services/agentServiceV4.js` - Case routes
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords

## Notes
- Use the existing `availabilityService.js` for conflict detection
- Meeting data is likely stored in a meetings collection in MongoDB
- Check how appointments handle time slots to maintain consistency
