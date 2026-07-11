# ObjectId Fix Task Tracking System

## Purpose
Track and manage the systematic fix of 584 MongoDB ObjectId query issues across 60 service files in the IntelliCare backend.

## Problem
Previous developers passed string IDs directly to MongoDB queries expecting `{ _id: "someStringId" }` to work, but MongoDB requires `{ _id: ObjectId("someStringId") }` for _id field queries.

## Structure

### Files in this folder:
- `00-MASTER-TASK-LIST.md` - Complete list of all files and instance counts
- `01-generatedMedicalFunctions-TASK.md` - 368 instances (highest priority)
- `02-agentServiceV4-TASK.md` - 39 instances
- `03-agentServiceClaude-TASK.md` - 7 instances
- `04-baaManagementService-TASK.md` - 11 instances
- `05-agentServiceHelpers-TASK.md` - 7 instances
- Additional task files to be created for each service...
- `CHECKPOINT.md` - Progress tracking, updated after each file completion
- `FIX-APPROACH.md` - Guide for how to fix each pattern type
- `README.md` - This file

## How to Use This System

### For Each File Fix:
1. Open the corresponding task file (e.g., `02-agentServiceV4-TASK.md`)
2. Review the instances listed with line numbers
3. Add ObjectId import to the service file
4. Fix each instance according to the pattern type
5. Test the service
6. Mark instances as complete in the task file
7. Update `CHECKPOINT.md` with progress

### Pattern Types:
- **Pattern 1:** Function parameters (convert at entry)
- **Pattern 2:** Object properties (verify already ObjectId)
- **Pattern 3:** Session/context variables (convert at source)
- **Pattern 4:** Document references (convert before query)

## Progress Summary
- **Total Files:** 60
- **Total Instances:** 584
- **Started:** January 10, 2024
- **Target Completion:** [TBD]

## Priority Order
1. generatedMedicalFunctions.js (368)
2. agentServiceV4.js (39)
3. baaManagementService.js (11)
4. patientPortalMessagingService.js (9)
5. [Continue down the list...]

## Important Notes
- NO workaround functions
- Fix at the source, not at query time
- Validate ObjectId format before converting
- Test after each file completion
- Update checkpoint file regularly