# ⚠️ CRITICAL: Context Pattern for SecureDataAccess

## The Correct Pattern (MUST USE THIS)

```javascript
const context = {
  serviceId: 'agentServiceV4',                                     // NOT 'agent-service'!
  operation: 'descriptive_operation_name',                         // e.g., 'get_patient_appointments'
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,  // Practice isolation
  apiKey: this.serviceToken?.apiKey || this.serviceToken          // Service authentication
};

const result = await SecureDataAccess.query(
  'collection_name',
  { /* filter */ },
  { /* options */ },
  context
);
```

## ❌ Common Mistakes (DO NOT USE)

### Wrong serviceId:
```javascript
serviceId: 'agent-service'  // ❌ WRONG - will fail authentication
```

### Missing apiKey:
```javascript
const context = {
  serviceId: 'agentServiceV4',
  operation: 'operation',
  practiceId: practiceContext.practiceId  // ❌ Missing apiKey!
};
```

### Wrong practiceId:
```javascript
practiceId: practiceContext.practiceId  // ❌ Should use subdomain first
```

## ✅ Correct Examples

### Query (Read):
```javascript
const context = {
  serviceId: 'agentServiceV4',
  operation: 'get_patient_appointments',
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
  apiKey: this.serviceToken?.apiKey || this.serviceToken
};

const appointments = await SecureDataAccess.query(
  'appointments',
  { patientId: new ObjectId(args.patientId) },
  { sort: { scheduledDate: -1 }, limit: 100 },
  context
);
```

### Insert (Create):
```javascript
const context = {
  serviceId: 'agentServiceV4',
  operation: 'create_appointment',
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
  apiKey: this.serviceToken?.apiKey || this.serviceToken
};

const result = await SecureDataAccess.insert(
  'appointments',
  {
    patientId: new ObjectId(args.patientId),
    scheduledDate: args.date,
    createdAt: new Date()
  },
  context
);
```

### Update:
```javascript
const context = {
  serviceId: 'agentServiceV4',
  operation: 'update_appointment',
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
  apiKey: this.serviceToken?.apiKey || this.serviceToken
};

const result = await SecureDataAccess.update(
  'appointments',
  { _id: new ObjectId(args.appointmentId) },
  {
    $set: {
      status: 'cancelled',
      updatedAt: new Date()
    }
  },
  context
);
```

### Delete:
```javascript
const context = {
  serviceId: 'agentServiceV4',
  operation: 'delete_appointment',
  practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
  apiKey: this.serviceToken?.apiKey || this.serviceToken
};

const result = await SecureDataAccess.delete(
  'appointments',
  { _id: new ObjectId(args.appointmentId) },
  context
);
```

## Why All 4 Fields Are Required

1. **serviceId**: Identifies which service is making the request (authentication)
2. **operation**: Tracks what operation is being performed (auditing)
3. **practiceId**: Ensures multi-tenant isolation (correct database)
4. **apiKey**: Service authentication token (security)

## Progress Tracking

After conversation compacting, check:
- `CHECKPOINT.md` - See how many tasks are done
- `task-XXX.md` files - Individual task status
- This file - Remember the correct pattern

## Current Status
- **Total Tasks**: 253
- **Completed**: See CHECKPOINT.md
- **Pattern Fixed**: All 253 task files + README.md updated with correct context pattern
