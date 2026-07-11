# Prescription Monitoring Service - Testing Guide

## Quick Start Testing

### Prerequisites
- Server running: `npm run dev` in backend-api
- Helen Cox exists as patient
- MongoDB accessible

---

## Test 1: Immediate Activation (Current/Past Date)

**Goal**: Verify prescription created with current date immediately becomes active and syncs to medications

```bash
# Create prescription for Helen Cox starting TODAY
POST http://localhost:5000/api/agent/prescription/create
Content-Type: application/json

{
  "patientId": "helen-cox-id",
  "medications": [
    {
      "name": "Dupilumab",
      "dosage": "300mg",
      "frequency": "weekly"
    }
  ],
  "instructions": "Inject subcutaneously",
  "startDate": "2025-10-17T09:00:00Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "66a1b2c3d4e5f6g7h8i9j0k1",
    "patientId": "helen-cox-id",
    "medications": [...],
    "status": "active",
    "prescribedDate": "2025-10-17T14:23:45.123Z",
    "startDate": "2025-10-17T09:00:00Z"
  }
}
```

**Verification in Logs:**
```
✅ [createPrescription] Synced prescription 66a1b2c3d4e5f6g7h8i9j0k1 to medications collection
```

**Check in Database:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
db.medications.findOne({ prescriptionId: ObjectId('66a1b2c3d4e5f6g7h8i9j0k1') })
"
# Should return: { name: 'Dupilumab', status: 'active', ... }
```

---

## Test 2: Future Activation (Scheduled for Later)

**Goal**: Verify prescription created with future date is pending and registered for monitoring

```bash
# Create prescription for Helen Cox starting NEXT WEEK
POST http://localhost:5000/api/agent/prescription/create
Content-Type: application/json

{
  "patientId": "helen-cox-id",
  "medications": [
    {
      "name": "Omalizumab",
      "dosage": "375mg",
      "frequency": "biweekly"
    }
  ],
  "instructions": "Inject subcutaneously",
  "startDate": "2025-10-24T10:00:00Z"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "77b2c3d4e5f6g7h8i9j0k1l2",
    "status": "pending",
    "startDate": "2025-10-24T10:00:00Z"
  }
}
```

**Verification in Logs:**
```
[createPrescription] startDate is in future (2025-10-24...), setting status to 'pending'
✅ [createPrescription] Registered pending prescription 77b2c3d4e5f6g7h8i9j0k1l2 for monitoring
```

**Check Global Metadata:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_global');
db.prescriptionActivationMetadata.findOne({
  prescriptionId: ObjectId('77b2c3d4e5f6g7h8i9j0k1l2')
})
"
# Should return: { prescriptionId: ..., status: 'pending', monitoringActive: true }
```

**Verify NOT in Medications:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
db.medications.countDocuments({ prescriptionId: ObjectId('77b2c3d4e5f6g7h8i9j0k1l2') })
"
# Should return: 0 (not synced yet)
```

---

## Test 3: Monitoring Cycle Activation

**Goal**: Verify monitoring service automatically activates prescription when startDate arrives

### Setup
1. Create prescription with future date (Test 2)
2. Verify it's pending in both DBs
3. Manually trigger monitoring cycle (OR wait for hourly cycle)

### Trigger Monitoring Cycle (For Testing)

Create a test file: `test-monitoring-cycle.js`

```javascript
const prescriptionMonitoringService = require('./services/prescriptionMonitoringService');

(async () => {
  try {
    await prescriptionMonitoringService.initialize();
    console.log('🚀 Running manual monitoring cycle...');
    await prescriptionMonitoringService.runMonitoringCycle();
    console.log('✅ Monitoring cycle complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
```

Run:
```bash
node test-monitoring-cycle.js
```

### Natural Test (Wait for Hourly Cycle)

Option 1: Create prescription for time in past (simulates future date that has arrived)
```bash
POST http://localhost:5000/api/agent/prescription/create
{
  "startDate": "2025-10-17T13:00:00Z"  # 1 hour ago (pretend it was future)
}
```

### Expected Logs When Activated
```
⏰ Running monitoring cycle...
📊 Found 1 prescription(s) ready for activation
💊 Activating prescription 77b2c3d4e5f6g7h8i9j0k1l2 for practice yale
✅ Updated prescription 77b2c3d4e5f6g7h8i9j0k1l2 to 'active' status
✅ Synced prescription 77b2c3d4e5f6g7h8i9j0k1l2 to medications collection
✅ Marked metadata for prescription 77b2c3d4e5f6g7h8i9j0k1l2 as activated
✅ Cycle complete: 1 activated, 0 failed (342ms)
```

### Verification After Activation

**Check Prescription Status:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
db.prescriptions.findOne({ _id: ObjectId('77b2c3d4e5f6g7h8i9j0k1l2') })
"
# Should show: status: 'active', activatedAt: <timestamp>
```

**Check Medications:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
db.medications.findOne({ prescriptionId: ObjectId('77b2c3d4e5f6g7h8i9j0k1l2') })
"
# Should now return the synced medication entry
```

**Check Global Metadata Updated:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_global');
db.prescriptionActivationMetadata.findOne({
  prescriptionId: ObjectId('77b2c3d4e5f6g7h8i9j0k1l2')
})
"
# Should show: status: 'activated', monitoringActive: false, activatedAt: <timestamp>
```

---

## Test 4: Update Prescription Status to Pending

**Goal**: Verify manual status change to 'pending' registers for monitoring

```bash
# Get prescription ID from Test 1 (was active)
PUT http://localhost:5000/api/agent/prescription/{prescriptionId}
Content-Type: application/json

{
  "status": "pending",
  "startDate": "2025-10-24T15:00:00Z"
}
```

**Expected Logs:**
```
✅ [updatePrescription] Registered prescription ... for monitoring (status changed to pending)
```

**Verification:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_global');
db.prescriptionActivationMetadata.findOne({
  prescriptionId: ObjectId('...')  # The prescription ID
})
"
# Should now exist in global metadata
```

---

## Test 5: Update Prescription Status to Active

**Goal**: Verify manual status change to 'active' syncs to medications immediately

```bash
# Get prescription ID from Test 4 (was pending)
PUT http://localhost:5000/api/agent/prescription/{prescriptionId}
Content-Type: application/json

{
  "status": "active"
}
```

**Expected Logs:**
```
✅ [updatePrescription] Synced prescription ... to medications collection (status changed to active)
```

**Verification:**
```bash
mongosh "$MONGO_URI" --quiet --eval "
db = db.getSiblingDB('intellicare_practice_yale');
db.medications.countDocuments({ prescriptionId: ObjectId('...') })
"
# Should return: 1 (synced successfully)
```

---

## Test 6: Multiple Practices

**Goal**: Verify monitoring service correctly handles multiple practices

### Setup
1. Create prescriptions in MULTIPLE practices (yale, stanford, etc.)
2. Schedule them for same future time
3. Trigger monitoring cycle

### Create in Different Practice
```bash
# Change X-Practice-Subdomain header
POST http://localhost:5000/api/agent/prescription/create
X-Practice-Subdomain: stanford

{
  "patientId": "patient-in-stanford",
  "medications": [{ "name": "Albuterol" }],
  "startDate": "2025-10-24T10:00:00Z"
}
```

### Verify Both Practices Processed
```
⏰ Running monitoring cycle...
📊 Found 2 prescription(s) ready for activation
💊 Activating prescription X for practice yale
💊 Activating prescription Y for practice stanford
✅ Cycle complete: 2 activated, 0 failed
```

---

## Test 7: Error Handling

**Goal**: Verify monitoring service handles errors gracefully

### Test Invalid Prescription ID in Metadata
```javascript
// Manually insert bad metadata
db.prescriptionActivationMetadata.insert({
  prescriptionId: ObjectId('000000000000000000000000'),
  practiceId: 'yale',
  startDate: new Date(Date.now() - 1000),  # Past date
  status: 'pending'
})
```

**Expected Logs:**
```
💊 Activating prescription 000000000000000000000000 for practice yale
⚠️ Failed to activate prescription 000000000000000000000000: prescription_not_found
✅ Cycle complete: 0 activated, 1 failed
```

---

## Test 8: Server Restart Recovery

**Goal**: Verify pending prescriptions resume after server restart

### Setup
1. Create prescription with future date (pending)
2. Server is running and monitoring
3. Stop server (Ctrl+C)
4. Restart server

**Expected Logs on Restart:**
```
✅ PrescriptionMonitoringService authenticated
🚀 Starting PrescriptionMonitoringService (first run immediate)
⏰ Running monitoring cycle...
📊 Found X prescription(s) ready for activation
[... activation continues ...]
✅ Prescription monitoring service started (checking hourly)
```

### Verification
Pending prescriptions are still there and ready to activate.

---

## Monitoring Service Statistics

**Get current statistics:**
```javascript
const prescriptionMonitoringService = require('./services/prescriptionMonitoringService');
const stats = await prescriptionMonitoringService.getStats();
console.log(stats);
// {
//   total: 15,
//   pending: 3,
//   activated: 12,
//   monitoringActive: 3
// }
```

---

## Troubleshooting

### Issue: Prescription created but no log of registration
**Check:**
1. startDate is actually in future: `new Date(startDate) > new Date()`
2. Server logs show initialization complete
3. Database connectivity (check for errors in logs)

### Issue: Monitoring cycle not running
**Check:**
1. Server logs show "Prescription monitoring service started"
2. Check server time is correct
3. Look for hourly marker in logs

### Issue: Medication not syncing
**Check:**
1. Prescription status is actually 'active'
2. Medications array is properly formatted
3. Check medicationService logs for errors

### Issue: Global metadata not found
**Check:**
1. Connected to correct database (intellicare_practice_global)
2. Collection name is exactly: prescriptionActivationMetadata
3. PrescriptionId is ObjectId, not string

---

## Load Testing

Create 100 pending prescriptions and verify all activate:

```javascript
const prescriptionService = require('./services/prescriptionService');

for (let i = 0; i < 100; i++) {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prescriptionService.createPrescription(
    {
      patientId: 'helen-cox-id',
      medications: [{ name: `Med${i}`, dosage: '100mg' }],
      startDate: futureDate.toISOString()
    },
    { subdomain: 'yale', userId: 'test' }
  );
}

// Later, trigger monitoring:
const stats = await prescriptionMonitoringService.getStats();
console.log(`Total: ${stats.total}, Pending: ${stats.pending}, Activated: ${stats.activated}`);
```

---

## Success Criteria ✅

All tests pass when:
- ✅ Prescriptions with current/past dates become active immediately
- ✅ Prescriptions with future dates become pending
- ✅ Pending prescriptions registered in global metadata
- ✅ Monitoring cycle runs hourly
- ✅ Prescriptions activate when startDate arrives
- ✅ Synced to medications collection automatically
- ✅ Multiple practices handled correctly
- ✅ Errors don't block other prescriptions
- ✅ Service recovers after restart
- ✅ Graceful shutdown without data loss

