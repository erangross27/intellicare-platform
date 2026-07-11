# Calendar Integration

## Overview
Shared calendar system providing unified view of appointments across all providers and practice resources.

## Key Components

### Frontend Calendar Display
- **Component**: `AppointmentsCard.js` - Individual appointment display with status badges
- **Features**: Expandable cards, multi-language labels, RTL/LTR support
- **Status Indicators**: Today, Tomorrow, Past, Cancelled with color coding

### Calendar View Methods
- `Appointment.findByProvider()` - Provider daily/weekly schedules
- `Appointment.findTodaysAppointments()` - Practice daily overview
- `Appointment.findByPatient()` - Patient appointment history

### Time Management
- **Date Formatting**: Locale-aware display (Hebrew/English)
- **Timezone**: Asia/Jerusalem default with timezone field support
- **Virtual Fields**: `isToday`, `isOverdue`, `timeUntilAppointment`

### Availability Blocks
- **Model**: `AvailabilityBlock` for provider busy times
- **Features**: Recurring blocks, day-of-week filtering
- **Integration**: Blocks busy slots in availability queries

### Calendar Operations
- Real-time status updates across all views
- Drag-drop rescheduling (frontend ready)
- Multi-provider conflict checking
- Resource scheduling (rooms, equipment)

## Success Criteria
- ✅ Unified calendar view for all practice staff
- ✅ Real-time availability updates
- ✅ Multi-provider schedule coordination
- ✅ Hebrew/English calendar localization