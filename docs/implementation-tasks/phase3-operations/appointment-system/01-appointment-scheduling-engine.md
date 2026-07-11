# Appointment Scheduling Engine

## Overview
Core scheduling system with availability checking, slot reservation, and conflict prevention for multi-provider practice environment.

## Key Components

### Database Model
- **Collection**: `appointments` (per practice)
- **Schema**: Complete Appointment model with encrypted patient data
- **Indexes**: Optimized for availability queries (`providerId`, `scheduledDate`, `status`, `scheduledTime`)

### Core Service Methods
- `AvailabilityService.getAvailableSlots()` - Cached availability checking (60s TTL)
- `AvailabilityService.reserveSlot()` - Optimistic locking for bookings
- `Appointment.updateStatus()` - Status transitions with audit trail
- `Appointment.reschedule()` - Rescheduling with conflict detection

### API Endpoints
- `POST /appointments` - Create new appointment
- `PUT /appointments/:id/reschedule` - Reschedule existing
- `GET /appointments/availability/:providerId` - Check provider slots
- `PUT /appointments/:id/status` - Update appointment status

### Business Rules
- Israel working hours: 9AM-5PM (Fri 9AM-12PM, Sat closed)
- 15-minute slot increments with duration-based blocking
- Conflict detection prevents double-booking
- 30-second slot locks during booking process

### Security Features
- Patient data encrypted at rest (phone, email, medical notes)
- Service authentication required for all operations
- Audit logging for all appointment changes
- Multi-tenant data isolation

## Success Criteria
- ✅ Zero double-bookings through optimistic locking
- ✅ Sub-second availability queries via caching
- ✅ Complete audit trail for compliance
- ✅ Multi-language support (Hebrew/English)