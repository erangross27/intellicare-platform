# callAPI → SecureDataAccess Refactoring Index

## Overview
This folder contains **253 refactoring tasks** to replace HTTP `callAPI()` calls with direct `SecureDataAccess` database access in `agentServiceV4.js`.

## Progress Tracking
- **Total Tasks:** 253
- **Completed:** 0 (see CHECKPOINT.md)
- **Remaining:** 253

## Task Categories

### Critical Functions (Fix First)
- Task 245: `getSystemHealth` - Currently broken, causing errors
- Tasks related to patient safety alerts
- Tasks related to critical patient data

### Appointments (Tasks 001-005)
- Task 001: GET /appointments/patient/:patientId
- Task 002: PUT /appointments/:appointmentId/reschedule
- Task 003: PUT /appointments/:appointmentId/status (cancel)
- Task 004: GET /appointments/today
- Task 005: GET /appointments/overdue

### Insurance (Tasks 006-009)
- Task 006: GET /insurance/patient/:patientId
- Task 007: PUT /insurance/patient/:patientId
- Task 008: POST /insurance/coverage/check
- Task 009: POST /insurance/preauth

### Imaging (Tasks 010-012)
- Task 010: POST /imaging/order
- Task 011: GET /imaging/patient/:patientId
- Task 012: POST /imaging/upload

### Prescriptions (Tasks 013-014)
- Task 013: POST /prescriptions/:prescriptionId/refill
- Task 014: PUT /prescriptions/:prescriptionId/cancel

### Referrals (Task 015)
- Task 015: PUT /referrals/:referralId/status

### Address Services (Tasks 016-018)
- Task 016: GET /address/autocomplete
- Task 017: GET /address/cities
- Task 018: POST /address/validate

### Security & Audit (Tasks 019-022)
- Task 019: GET /security/audit-logs
- Task 020: GET /security/events
- Task 021: POST /compliance/report
- Task 022: POST /security/audit-report/export

### All Tasks
See individual task files: `task-001.md` through `task-253.md`

## How to Use This Refactoring Guide

### 1. Pick a Task
```bash
# See next task to work on
cat CHECKPOINT.md

# Open specific task file
cat task-001.md
```

### 2. Refactor the Function
- Read the task file
- Identify the collection(s) needed
- Replace callAPI with SecureDataAccess
- Add proper context with serviceId: 'agent-service'

### 3. Mark Complete
Update CHECKPOINT.md:
```markdown
## Completed Tasks
- [x] Task 001: Line 10075 - GET /appointments/patient/:patientId - Fixed on 2025-10-06
```

### 4. Test
Verify the refactored function works correctly

## Key Principles

### ❌ Wrong (Current)
```javascript
await this.callAPI('/endpoint', 'GET', args, practiceContext);
```

### ✅ Correct (Target)
```javascript
const context = {
  serviceId: 'agent-service',
  operation: 'operation_name',
  practiceId: practiceContext.practiceId
};

const result = await SecureDataAccess.query(
  'collection_name',
  { patientId: args.patientId },
  { sort: { date: -1 }, limit: 100 },
  context
);
```

## Files
- **CHECKPOINT.md** - Track completion progress
- **task-XXX.md** - Individual refactoring tasks (253 files)
- **INDEX.md** - This file (master index)
- **README.md** - Detailed refactoring patterns and examples
