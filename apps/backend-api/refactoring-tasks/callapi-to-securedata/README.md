# Refactoring Guide: callAPI → SecureDataAccess

## Why This Refactoring?

### The Problem
280 functions in `agentServiceV4.js` make HTTP calls back to the server using `callAPI()`:
- Creates unnecessary HTTP overhead
- Bypasses proper security context
- Causes errors when endpoints don't exist
- Violates architectural principle: services should use `SecureDataAccess` directly

### The Solution
Replace all `callAPI()` with direct `SecureDataAccess` database access.

## SecureDataAccess Patterns

### Pattern 1: Query Data (Read)
```javascript
// ❌ OLD: HTTP call
const response = await this.callAPI('/appointments/patient/123', 'GET', args, practiceContext);

// ✅ NEW: Direct database access
const context = {
  serviceId: 'agent-service',
  operation: 'get_patient_appointments',
  practiceId: practiceContext.practiceId
};

const appointments = await SecureDataAccess.query(
  'appointments',
  { patientId: new ObjectId(args.patientId) },
  { sort: { date: -1 }, limit: 100 },
  context
);
```

### Pattern 2: Insert Data (Create)
```javascript
// ❌ OLD: HTTP call
const response = await this.callAPI('/appointments', 'POST', appointmentData, practiceContext);

// ✅ NEW: Direct database insert
const context = {
  serviceId: 'agent-service',
  operation: 'create_appointment',
  practiceId: practiceContext.practiceId
};

const result = await SecureDataAccess.insert(
  'appointments',
  {
    ...appointmentData,
    createdAt: new Date(),
    practiceId: practiceContext.practiceId
  },
  context
);
```

### Pattern 3: Update Data
```javascript
// ❌ OLD: HTTP call
const response = await this.callAPI(`/appointments/${id}`, 'PUT', updates, practiceContext);

// ✅ NEW: Direct database update
const context = {
  serviceId: 'agent-service',
  operation: 'update_appointment',
  practiceId: practiceContext.practiceId
};

const result = await SecureDataAccess.update(
  'appointments',
  { _id: new ObjectId(id) },
  { $set: updates },
  context
);
```

### Pattern 4: Delete Data
```javascript
// ❌ OLD: HTTP call
const response = await this.callAPI(`/appointments/${id}`, 'DELETE', {}, practiceContext);

// ✅ NEW: Direct database delete
const context = {
  serviceId: 'agent-service',
  operation: 'delete_appointment',
  practiceId: practiceContext.practiceId
};

const result = await SecureDataAccess.delete(
  'appointments',
  { _id: new ObjectId(id) },
  context
);
```

### Pattern 5: Aggregate Data
```javascript
// ❌ OLD: HTTP call to get statistics
const response = await this.callAPI('/appointments/stats', 'GET', {}, practiceContext);

// ✅ NEW: Direct aggregation
const context = {
  serviceId: 'agent-service',
  operation: 'get_appointment_stats',
  practiceId: practiceContext.practiceId
};

const stats = await SecureDataAccess.aggregate(
  'appointments',
  [
    { $match: { practiceId: practiceContext.practiceId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ],
  context
);
```

## Common Collections Map

### Endpoint → Collection Mapping
| HTTP Endpoint | Collection Name |
|--------------|-----------------|
| `/appointments/*` | `appointments` |
| `/patients/*` | `patients` |
| `/prescriptions/*` | `prescriptions` |
| `/insurance/*` | `insurance_verifications` |
| `/imaging/*` | `imaging_orders` |
| `/referrals/*` | `referrals` |
| `/users/*` | `users` |
| `/documents/*` | `documents` |
| `/medical-data/*` | Various medical collections |
| `/security/audit-logs` | `audit_logs` |
| `/practices/*` | `practices` |

## Context Object Requirements

### Always Include:
```javascript
const context = {
  serviceId: 'agentServiceV4',                              // REQUIRED: Service identifier
  operation: 'descriptive_operation',                       // REQUIRED: What operation
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,  // REQUIRED: Practice isolation
  apiKey: this.serviceToken?.apiKey || this.serviceToken   // REQUIRED: Service authentication
};
```

⚠️ **CRITICAL**: All 4 fields are required:
- `serviceId: 'agentServiceV4'` (NOT 'agent-service')
- `operation: 'operation_name'`
- `practiceId: practiceContext?.subdomain || practiceContext?.practiceId`
- `apiKey: this.serviceToken?.apiKey || this.serviceToken`

### Optional Fields:
```javascript
const context = {
  serviceId: 'agent-service',
  operation: 'operation_name',
  practiceId: practiceContext.practiceId,
  practiceSubdomain: practiceContext.subdomain,  // Optional: subdomain
  sessionId: session?.id                         // Optional: session tracking
};
```

## ObjectId Handling

### Always convert string IDs to ObjectId:
```javascript
const { ObjectId } = require('mongodb');

// For patientId
const patientObjectId = new ObjectId(args.patientId);

// For query
const result = await SecureDataAccess.query(
  'collection',
  { patientId: patientObjectId },  // Use ObjectId
  {},
  context
);
```

## Error Handling

### Wrap in try-catch:
```javascript
try {
  const result = await SecureDataAccess.query(
    'collection',
    filter,
    options,
    context
  );

  return { success: true, data: result };
} catch (error) {
  console.error('Error querying collection:', error);
  throw error;
}
```

## Testing After Refactoring

### 1. Unit Test
```bash
# Test the specific function
node -e "const service = require('./services/agentServiceV4'); ..."
```

### 2. Integration Test
- Use the WebGUI to trigger the function
- Verify data is correctly read/written
- Check logs for errors

### 3. Update CHECKPOINT.md
```markdown
- [x] Task 001: Line 10075 - GET /appointments/patient/:patientId - Completed 2025-10-06
```

## Examples

### Example 1: getSystemHealth (Task 245)
**Before:**
```javascript
async getSystemHealth(params, practiceContext) {
  const response = await this.callAPI('/health', 'GET', params, practiceContext);
  return response.data;
}
```

**After:**
```javascript
async getSystemHealth(params, practiceContext) {
  // Direct system health - no HTTP needed
  return {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'agentServiceV4'
  };
}
```

### Example 2: Get Patient Appointments
**Before:**
```javascript
return await this.callAPI(`/appointments/patient/${args.patientId}`, 'GET', args, practiceContext);
```

**After:**
```javascript
const { ObjectId } = require('mongodb');

const context = {
  serviceId: 'agent-service',
  operation: 'get_patient_appointments',
  practiceId: practiceContext.practiceId
};

const appointments = await SecureDataAccess.query(
  'appointments',
  { patientId: new ObjectId(args.patientId) },
  {
    sort: { scheduledDate: -1 },
    limit: args.limit || 100
  },
  context
);

return {
  success: true,
  data: appointments,
  count: appointments.length
};
```

## Quick Reference

### SecureDataAccess Methods:
1. `SecureDataAccess.query(collection, filter, options, context)` - Read
2. `SecureDataAccess.insert(collection, document, context)` - Create
3. `SecureDataAccess.update(collection, filter, updates, context)` - Update
4. `SecureDataAccess.delete(collection, filter, context)` - Delete
5. `SecureDataAccess.aggregate(collection, pipeline, context)` - Aggregate

### Service Account:
- Always use `serviceId: 'agent-service'`
- This service account has proper permissions for all operations

## Progress Tracking
See `CHECKPOINT.md` for current progress and completed tasks.
