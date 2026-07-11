# TASK 4: Drug Shortages

## Status: COMPLETE ✅

## Overview
Alert doctors when a patient's medication is currently in shortage, so they can plan alternatives or stock up.

## API Details
- **Source:** openFDA Drug Shortages Database
- **Endpoint:** `/drug/shortages.json`
- **API Key:** Configured in KMS (OPENFDA_API_KEY.json)

## Implementation Summary

### Backend (Complete)

1. **externalApiGatewayService.js**
   - Added `drugShortages: '/drug/shortages.json'` to openFDA endpoints

2. **drugInformationService.js** - Added functions:
   - `checkForDrugShortages()` - Fetches FDA shortages, stores in `drug_shortages` collection
   - `findPatientsWithMedication(drugName)` - Matches patients across practices
   - `createDrugShortageAlert(patientId, medication, shortage)` - Creates patient-specific alerts
   - `getProviderDrugShortageAlerts()` - Provider-filtered alerts
   - `getDrugShortages()` - Get current shortage list
   - `mapShortageToSeverity(status)` - Maps FDA status to severity

3. **external.js** - Added routes:
   - `GET /api/external/drug-shortages/provider-alerts` - Provider-specific alerts
   - `GET /api/external/drug-shortages/list` - Current shortage list
   - `POST /api/external/drug-shortages/check-now` - Manual check trigger

4. **secureDataAccess.js** - Added to skipSoftDelete arrays:
   - `drug_shortages` - FDA shortage records
   - `patient_drug_shortage_alerts` - Patient-specific alerts

### Frontend (Complete)

5. **DrugShortageAlerts.js** - New component with:
   - Yellow/amber warning theme (#f59e0b colors)
   - Pill icon (rotated capsule shape)
   - Shows: medication name, dosage, severity, reason, expected resolution
   - Copy button with severity-colored feedback
   - Hebrew and English translations

6. **MinimalSidebar.js**:
   - Added `DrugShortageIcon` (amber pill icon)
   - Added to icons array with action: 'drug-shortages'
   - Added to onClick handler

7. **ChatContainer.js**:
   - Added lazy import for `DrugShortageAlerts`
   - Added `drug-shortages` to expandedSection handler
   - Added accordion section with amber pill icon

## Patient Data Sources
- `medications` - Current patient medications (has name, dosage, NDC)
- `prescriptions` - Active prescriptions

## Severity Mapping
- "Currently in Shortage" → HIGH (amber #f59e0b)
- "Resolved" → LOW (light yellow #fde68a)
- Other → MEDIUM (yellow #fbbf24)

## Color Theme (Yellow/Amber for Warnings)
- High Severity: #f59e0b (amber)
- Medium Severity: #fbbf24 (yellow)
- Low Severity: #fde68a (light yellow)
- Icon Color: #f59e0b (amber)

## Priority: HIGH ✅
- Directly impacts patient care
- Helps doctors plan ahead
- Prevents last-minute scrambling

## Completed: 2025-12-08
