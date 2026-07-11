# Task 001: getAppointments Grid Implementation

## Function Details
- **Function Name**: getAppointments
- **Category**: Core Medical Records
- **Collection**: appointments
- **Priority**: HIGH (Most used function)

## Grid Column Configuration

### Primary Columns
| Column ID | Display Name | Data Type | Width | Sortable | Filterable | Format |
|-----------|-------------|-----------|--------|----------|------------|---------|
| patientName | Patient Name | string | 200px | ✅ | ✅ | Full Name |
| appointmentDate | Date | date | 120px | ✅ | ✅ | MM/DD/YYYY |
| appointmentTime | Time | time | 100px | ✅ | ✅ | HH:MM AM/PM |
| providerName | Provider | string | 180px | ✅ | ✅ | Dr. LastName |
| department | Department | string | 150px | ✅ | ✅ | Title Case |
| appointmentType | Type | string | 150px | ✅ | ✅ | Dropdown |
| status | Status | enum | 120px | ✅ | ✅ | Badge |
| reason | Reason | string | 250px | ❌ | ✅ | Text |
| duration | Duration | number | 100px | ✅ | ❌ | XX mins |
| location | Location | string | 150px | ✅ | ✅ | Room/Clinic |

### Hidden Columns (for actions/linking)
- appointmentId (ObjectId)
- patientId (ObjectId)
- providerId (ObjectId)

### Status Values & Colors
- Scheduled: 🟦 Blue
- Confirmed: 🟩 Green
- In Progress: 🟨 Yellow
- Completed: ⬜ Gray
- Cancelled: 🟥 Red
- No Show: 🟧 Orange

## Data Formatting Rules

### Date/Time Formatting
```javascript
formatters: {
  appointmentDate: (value) => {
    // Convert ISO date to MM/DD/YYYY
    // Handle timezone conversion based on practice location
  },
  appointmentTime: (value) => {
    // Convert 24hr to 12hr format
    // Show in practice's local timezone
  },
  duration: (value) => {
    // Convert minutes to "1h 30m" format
  }
}
```

### Special Handling
- Past appointments: Gray out row
- Today's appointments: Highlight with border
- Urgent/Emergency: Red indicator
- Telehealth: Show video icon
- First visit: Show "NEW" badge

## Filter Options

### Quick Filters
- Today
- This Week
- This Month
- Upcoming
- Past
- Cancelled

### Advanced Filters
- Date Range
- Provider
- Department
- Status
- Appointment Type
- Location

## Sorting Options
- Default: Date + Time (ascending)
- Secondary: Provider name
- Tertiary: Patient name

## Row Actions
- View Details
- Edit Appointment
- Cancel Appointment
- Reschedule
- Send Reminder
- Check In Patient
- Mark No Show
- View Patient Record

## Bulk Actions
- Send Reminders (selected)
- Export to Calendar
- Print Schedule
- Cancel Multiple

## Export Options
- CSV (with all columns)
- PDF (formatted schedule)
- Excel (with filters preserved)
- Calendar (.ics file)

## Performance Considerations
- Virtual scrolling after 100 rows
- Lazy load patient photos
- Cache provider names
- Index on date + status

## Mobile Responsive Design
- Collapse to card view on mobile
- Show only: Patient, Date, Time, Provider
- Swipe actions for common tasks

## Accessibility Requirements
- ARIA labels for all buttons
- Keyboard navigation support
- Screen reader announcements
- High contrast mode support

## Integration Points
- Link to patient record
- Link to provider schedule
- Integration with reminder service
- Sync with calendar systems

## Test Scenarios
1. Load 1000+ appointments
2. Filter by multiple criteria
3. Sort by each column
4. Export large dataset
5. Bulk operations on 50+ items
6. Mobile view functionality
7. Real-time status updates

## API Response Structure
```javascript
{
  success: true,
  data: [
    {
      appointmentId: "ObjectId",
      patientId: "ObjectId",
      patientName: "John Doe",
      appointmentDate: "2025-01-26",
      appointmentTime: "14:30",
      providerName: "Dr. Smith",
      department: "Cardiology",
      appointmentType: "Follow-up",
      status: "Scheduled",
      reason: "Post-op checkup",
      duration: 30,
      location: "Room 203"
    }
  ],
  totalCount: 150,
  metadata: {
    gridType: "appointments",
    columns: [...],
    filters: {...}
  }
}
```

## Implementation Steps
1. [ ] Create grid column configuration in functionGridMappings.js
2. [ ] Add data formatters in gridDataFormatter.js
3. [ ] Implement filter logic in backend
4. [ ] Create AppointmentsGrid component
5. [ ] Add export functionality
6. [ ] Implement row/bulk actions
7. [ ] Add mobile responsive design
8. [ ] Write unit tests
9. [ ] Write integration tests
10. [ ] Performance testing
11. [ ] Accessibility audit
12. [ ] Documentation

## Dependencies
- DataGrid component library
- Date formatting library (date-fns)
- Export library (xlsx, jspdf)
- Icons library for status badges

## Estimated Time
- Backend: 4 hours
- Frontend: 6 hours
- Testing: 3 hours
- Total: 13 hours

## Notes
- Most frequently accessed grid in the system
- Needs real-time updates via WebSocket
- Consider adding appointment conflict detection
- Support recurring appointments display