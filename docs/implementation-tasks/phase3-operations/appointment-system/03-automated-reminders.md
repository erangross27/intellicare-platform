# Automated Reminders

## Overview
Comprehensive reminder system using cron jobs to automatically notify patients of upcoming appointments via multiple channels.

## Key Components

### Reminder Service
- **Service**: `reminderService.js` - Automated reminder processing
- **Schedule**: Runs every 15 minutes (`*/15 * * * *`)
- **Channels**: SMS, Email, Phone, Push notifications

### Reminder Logic
- **Timing**: 24h, 2h, 30min before appointment
- **Patient Preferences**: Channel selection per patient
- **Delivery Tracking**: Status updates in `remindersSent` array
- **Retry Logic**: Failed delivery retry mechanism

### Database Integration
- **Field**: `remindersSent[]` in Appointment model
- **Tracking**: Type, sentDate, sentBy, delivered status
- **Audit**: Complete delivery history for compliance

### Reminder Methods
- `Appointment.addReminder()` - Log reminder sent
- `reminderService.processAppointmentReminders()` - Main cron handler
- `reminderService.sendReminderNotification()` - Channel dispatch

### Message Templates
- Multi-language templates (Hebrew/English)
- Appointment details inclusion (time, provider, location)
- Practice branding and contact information
- Confirmation links for patient responses

### Configuration
- Reminder timing intervals configurable per practice
- Channel preferences per patient type
- Emergency/urgent appointment immediate notifications
- Holiday and weekend scheduling adjustments

## Success Criteria
- ✅ Automated 24/7 reminder processing
- ✅ Multi-channel notification delivery
- ✅ Complete delivery audit trail
- ✅ Reduced no-show rates through timely reminders