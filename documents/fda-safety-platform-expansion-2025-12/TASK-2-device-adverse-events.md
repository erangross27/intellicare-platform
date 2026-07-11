# TASK 2: Medical Device Adverse Events

## Status: BACKEND COMPLETE (Frontend Deferred)

## Overview
Show doctors reported adverse events (injuries, malfunctions, deaths) associated with devices their patients use. This is informational - helps doctors make informed decisions about device monitoring.

## API Details
- **Endpoint:** `https://api.fda.gov/device/event.json`
- **Documentation:** https://open.fda.gov/apis/device/event/
- **Data Source:** FDA MAUDE (Manufacturer and User Facility Device Experience)

## Use Cases
1. Doctor sees patient has Medtronic ICD
2. System shows: "47 adverse events reported for this device type in last year"
3. Doctor can view: types of events, severity, what to watch for

## Implementation Steps

### Backend - COMPLETE

1. [x] Existing `getDeviceAdverseEvents(deviceName)` function
   - Query `/device/event.json` by device
   - Returns individual events

2. [x] Add `getDeviceSafetyProfile(manufacturer, model)` function - NEW
   - Query `/device/event.json` by manufacturer and model
   - Aggregate by event type (death, injury, malfunction)
   - Calculate percentages and risk level
   - Extract common issues from event descriptions
   - Handle 404 response (no results) gracefully

### Backend Routes - COMPLETE

3. [x] Add routes:
   - `GET /api/external/device-events/safety-profile` - Summarized safety profile
   - `GET /api/external/device-events/list` - List of individual events

### Frontend - DEFERRED

4. [ ] Add to device detail view (not sidebar)
   - Show when viewing patient's device records
   - "Safety Profile" section

5. [ ] Create `DeviceSafetyProfile.js` component
   - Pie chart of event types
   - List of common issues
   - Link to FDA database

**Note:** Frontend deferred because this is informational (not urgent alerts) and requires integration with the patient device detail views. Priority is MEDIUM.

## API Response Fields
```json
{
  "event_type": "Injury",
  "device": {
    "manufacturer_d_name": "MEDTRONIC",
    "brand_name": "EVERA MRI",
    "generic_name": "Implantable Cardioverter Defibrillator"
  },
  "mdr_text": [
    {"text": "Patient received inappropriate shock..."}
  ],
  "date_received": "20251101"
}
```

## Safety Profile Response
```json
{
  "manufacturer": "Medtronic",
  "model": "Evera MRI",
  "totalEvents": 47,
  "recentEvents": 100,
  "eventBreakdown": [
    { "type": "Malfunction", "count": 31, "percentage": 66 },
    { "type": "Injury", "count": 12, "percentage": 26 },
    { "type": "Death", "count": 4, "percentage": 8 }
  ],
  "commonIssues": [
    { "rank": 1, "description": "Inappropriate shock delivery..." },
    { "rank": 2, "description": "Lead fracture..." }
  ],
  "riskLevel": "HIGH",
  "fdaLink": "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfMAUDE/search.CFM"
}
```

## Files Modified
- `apps/backend-api/services/drugInformationService.js` - Added getDeviceSafetyProfile()
- `apps/backend-api/routes/external.js` - Added device-events routes

## Priority: MEDIUM
This is informational/educational, not urgent alerts like recalls.

## Completed
- Backend: 2025-12-08
- Frontend: DEFERRED
- Session: 414d32c2-39a3-459a-abcb-fb2c7ca16084
