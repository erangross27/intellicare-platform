# OpenFDA Integration - Quick Reference Guide

## Key Files Location

| Purpose | File | Key Methods |
|---------|------|-------------|
| **Main FDA Service** | `/apps/backend-api/services/drugInformationService.js` | `checkDrugInteractions()`, `validatePrescription()`, `checkDrugSafety()` |
| **Safety Orchestration** | `/apps/backend-api/services/medicationSafetyChecker.js` | `checkNewMedication()` |
| **Allergy Checking** | `/apps/backend-api/services/allergyChecker.js` | `checkAllergies()` |
| **API Routes** | `/apps/backend-api/routes/external.js` | Drug search, safety check, interaction check endpoints |
| **External Gateway** | `/apps/backend-api/services/externalApiGatewayService.js` | API key management, caching, rate limiting |
| **Medication Mgmt** | `/apps/backend-api/services/medicationService.js` | `addMedication()`, `buildMedicationFilter()` |
| **Prescription Monitor** | `/apps/backend-api/services/prescriptionMonitoringService.js` | Hourly activation/expiration checks |

---

## FDA APIs Integrated

| API | Endpoint | Purpose | Rate Limit |
|-----|----------|---------|-----------|
| Drug Labels | `/drug/label.json` | Drug info, contraindications, warnings | 240 req/min |
| Adverse Events | `/drug/event.json` | MedWatch reports, safety data | 240 req/min |
| Enforcement | `/drug/enforcement.json` | Recalls, Class I/II/III safety actions | 240 req/min |
| NDC Lookup | `/drug/ndc.json` | Drug code validation | 240 req/min |
| Device 510k | `/device/510k.json` | Device clearance records | 240 req/min |
| Device Recalls | `/device/recall.json` | Device recalls & adverse events | 240 req/min |
| Food Enforcement | `/food/enforcement.json` | Food recalls & enforcement | 240 req/min |
| Tobacco Products | `/tobacco/problem.json` | Tobacco oversight & compliance | 240 req/min |

---

## Drug Interaction Checking

### Local Database Architecture
- **Database**: `intellicare_drug_data` (separate from patient data)
- **Collection**: `drug_interactions`
- **Index**: Compound index on (drugA, drugB) for O(1) lookups
- **Why Local**: Performance, reliability, offline capability, HIPAA compliance

### Severity Levels (Sorted by Risk)
1. **CONTRAINDICATED** (Severity 4) - Absolute contraindication, never combine
2. **MAJOR** (Severity 5) - Life-threatening or requires medical intervention
3. **MODERATE** (Severity 3) - Clinically significant effects
4. **MINOR** (Severity 1) - Limited clinical significance

### How to Check Interactions
```javascript
const result = await drugInformationService.checkDrugInteractions(
  ['aspirin', 'warfarin', 'metformin'],
  { userId: 'user-id' }
);

// Returns:
{
  medications: [...],
  totalInteractions: 2,
  contraindicated: 0,
  majorInteractions: 1,
  moderateInteractions: 1,
  interactions: [ { drug1, drug2, severity, description, management } ],
  riskAssessment: { level, message, recommendations }
}
```

---

## Safety Alert System

### Alert Thresholds (drugInformationService.js:33-39)
- Adverse Events: >10 in 30 days → ALERT
- Recall Severity: Class I → CRITICAL ALERT
- Drug Interaction: MAJOR → HIGH ALERT
- Device Events: >5 → ALERT
- Food Recalls: >3 → ALERT

### Safety Scoring Algorithm (0-100)
```
Base Score: 100
- Adverse events: -2 per event (max -30)
- Class I recall: -20 each
- Class II recall: -10 each

Risk Level:
- Score >= 80: LOW
- Score 60-79: MEDIUM
- Score < 60: HIGH
```

### Monitoring Frequency
- **Real-time**: When medications added/changed
- **Hourly**: FDA recall checking (via cron)
- **On-demand**: Safety assessments via API
- **Continuous**: Audit logging for all operations

---

## Patient Medication Safety Workflow

### When Adding New Medication
```
1. Retrieve patient's current medications (DB)
2. Retrieve patient's allergies (DB)
3. Combine with medications from current document
4. Check ALL medication pairs for interactions
5. Check allergy cross-sensitivity
6. Generate safety report with:
   - Errors (critical issues)
   - Warnings (cautions)
   - Alternatives (if needed)
   - Management recommendations
7. Log to audit_logs collection
```

### Safety Report Example
```javascript
{
  medicationName: "Aspirin",
  isSafe: false,
  hasWarnings: true,
  hasErrors: true,
  errors: [
    {
      type: 'MAJOR_DRUG_INTERACTION',
      severity: 'CRITICAL',
      message: 'Major interaction with Warfarin: Increased bleeding risk',
      management: 'Monitor INR closely, consider alternative',
      source: 'FDA Drug Interaction Database'
    }
  ],
  warnings: [ ... ],
  alternatives: [ { name, reason, safetyScore } ],
  summary: '⛔ 1 critical safety issue detected. DO NOT PRESCRIBE without review.'
}
```

---

## Allergy Cross-Sensitivity Database

### Major Categories (in allergyChecker.js)
- Beta-Lactams (Penicillin ↔ Cephalosporins: 5-10% cross)
- Sulfa Drugs (Sulfonamides + Diuretics)
- NSAIDs (Aspirin, Ibuprofen, Naproxen: 5-10% cross)
- Opioids (Natural vs synthetic: varies)
- Local Anesthetics (Amide vs Ester)
- Contrast Media (Iodine-based)
- Latex (Food cross-reactivity: 30-50%)
- Egg (Vaccine safety: <1% risk now)

### Severity Levels
- **Mild**: Rash, itching, hives
- **Moderate**: Widespread rash, facial swelling, wheezing
- **Severe**: Angioedema, bronchospasm, hypotension
- **Anaphylaxis**: Airway compromise, cardiovascular collapse

### Alternative Medications by Allergy
```javascript
{
  penicillin_allergy: ['azithromycin', 'levofloxacin', 'doxycycline'],
  sulfa_allergy: ['penicillin', 'cephalosporin', 'azithromycin'],
  nsaid_allergy: ['acetaminophen', 'tramadol', 'opioids'],
  opioid_allergy: ['acetaminophen', 'nsaids', 'gabapentin']
}
```

---

## API Endpoints Quick Reference

### Drug Information
```
GET/POST /api/external/drugs/search
  Input: { q: "drug name", limit: 10 }
  Rate: 100 req/min

POST /api/external/drugs/safety-check
  Input: { drugName: "aspirin" }
  Rate: 50 req/min

POST /api/external/drugs/interaction-check
  Input: { medications: ["med1", "med2", ...] }
  Rate: 30 req/min

POST /api/external/drugs/validate-prescription
  Input: { drugName, ndc, dosage, existingMedications }
  Rate: 100 req/min
```

### Device Information
```
GET /api/external/devices/search
GET /api/external/devices/recalls
GET /api/external/devices/adverse-events
```

### Food & Compliance
```
GET /api/external/food/enforcement
GET /api/external/food/search
GET /api/external/tobacco/products
```

---

## Database Collections

### Drug-Related Collections
- `drug_interactions` - Local interaction database (intellicare_drug_data)
- `medications` - Patient medications (practice DB)
- `allergies` - Patient allergies (practice DB)
- `safety_alerts` - Generated alerts (practice DB)
- `audit_logs` - All safety operations logged (practice DB)

---

## Security & Compliance

### HIPAA Protections
- No PHI in drug interaction database
- Separate `intellicare_drug_data` database (no patient data)
- SecureDataAccess for all patient data queries
- Audit logging of all operations
- KMS-encrypted API keys

### Data Isolation
- Dual database pattern: Global metadata + Practice-specific PHI
- Prescription monitoring uses metadata only (no names/dosages)
- Practice-aware multi-tenant isolation
- Service authentication via ServiceAccountManager

### Audit Trail
All operations logged with: action, resource type, user ID, timestamp, details

---

## Prescription Monitoring Service

### Lifecycle Management (Hourly)
1. Find pending prescriptions (startDate <= now)
2. Activate them in practice database
3. Sync to medications collection
4. Find expired medications (endDate <= now)
5. Mark as inactive
6. Update global metadata

### Status Tracking
- Pending → Active (when startDate arrives)
- Active → Inactive (when endDate arrives)
- Excluded: Expired medications by default in queries

---

## Performance Characteristics

### Lookup Performance
- Drug interaction check: O(1) with indexed compound lookup
- Medication filter: Indexed queries on patientId, status
- Cache: 5-min default TTL, custom per-API

### Rate Limiting
- OpenFDA: 240 req/min, 120K/day
- Prescription validation: 100 req/min
- Interaction check: 30 req/min
- Safety check: 50 req/min

### Monitoring
- Real-time: On medication change
- Hourly: FDA recalls
- On-demand: Safety assessments
- Continuous: Audit logging

---

## Error Handling & Fallbacks

### Graceful Degradation
- Missing API keys: Warning only, system continues
- Failed interaction check: Returns "cannot verify" status
- Missing allergies: Assumes safe (conservative approach)
- Service initialization: Optional, system doesn't crash

### Offline Capability
- Local drug interaction database: Always available
- Embedded cross-sensitivity knowledge base
- Alternative medication suggestions: No API needed
- Cached FDA responses available

---

## Testing Commands

```bash
# Check service authentication
curl -X POST http://localhost:5000/api/external/drugs/safety-check \
  -H "Content-Type: application/json" \
  -d '{"drugName": "aspirin"}'

# Interaction check
curl -X POST http://localhost:5000/api/external/drugs/interaction-check \
  -H "Content-Type: application/json" \
  -d '{"medications": ["aspirin", "warfarin"]}'

# Prescription validation
curl -X POST http://localhost:5000/api/external/drugs/validate-prescription \
  -H "Content-Type: application/json" \
  -d '{"drugName": "aspirin", "dosage": "500mg", "existingMedications": ["warfarin"]}'
```

---

## Key Architecture Decisions

1. **Local DB vs API**: Use local MongoDB for drug interactions (faster, more reliable)
2. **Dual Database Pattern**: Separate drug data from patient data for HIPAA
3. **Metadata Monitoring**: Prescription monitoring uses global metadata only
4. **Compound Indexing**: (drugA, drugB) index for instant pair lookups
5. **Embedded Fallbacks**: Cross-sensitivity knowledge doesn't require API calls
6. **Hourly Monitoring**: Balance between freshness and system load
7. **Service Isolation**: Each service authenticates independently
8. **Audit Everything**: All safety operations logged for compliance

---

## Future Enhancement Areas

1. RxNorm integration for semantic drug matching
2. CYP450 interaction prediction
3. Pregnancy/lactation warning enrichment
4. Renal/hepatic dosage adjustments
5. Real-time OpenFDA API sync
6. ML pattern detection in adverse events
7. Population health trending

