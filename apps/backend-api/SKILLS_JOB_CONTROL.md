# Skills Job Control & Recovery

## Overview

This document describes the job control and recovery system for Claude Skills API document analysis jobs.

## Problem Statement

Previously, there was no way to manually stop a running Skills job. Issues:

1. **No manual stop**: Pressing Ctrl+C killed the backend but didn't mark the job as stopped
2. **Auto-recovery on restart**: ALL pending/processing jobs were automatically restarted on backend restart
3. **User lost control**: If you manually stopped a job, it would restart on next backend launch

## Solution

Implemented a **manual stop** system with graceful shutdown:

### 1. Graceful Shutdown on Ctrl+C

When you press `Ctrl+C` while a Skills job is running:

```javascript
// In documentAnalysisWithSkills.js
process.on('SIGINT', async () => {
  await instance.gracefulShutdown();
});
```

**What happens:**
1. Active job ID is tracked during processing
2. On Ctrl+C, the job is marked as `manually_stopped`
3. Job records are deleted from both databases
4. PendingUploads are cleaned up
5. Backend shuts down gracefully

### 2. Recovery Logic Update

Recovery now **SKIPS** manually stopped jobs:

```javascript
// In skillsJobTracker.js
async getJobsForRecovery() {
  const stuckJobs = await SecureDataAccess.query(
    'skills_job_metadata',
    {
      status: { $in: ['pending', 'processing'] },  // EXCLUDES manually_stopped
      monitoringActive: true,
      retryCount: { $lt: 3 }
    }
  );
  return stuckJobs || [];
}
```

**Job statuses:**
- `pending` - Job registered, not started yet → **Will be recovered**
- `processing` - Job actively running → **Will be recovered** (only if crashed)
- `completed` - Job finished successfully → **Deleted immediately**
- `failed` - Job failed after max retries → **Kept for debugging**
- `manually_stopped` - **NEW** - User pressed Ctrl+C → **Deleted, NOT recovered**

### 3. API Endpoint for Manual Cancellation

New endpoint to cancel running jobs from frontend:

```bash
POST /api/agent/cancel-skills-job
```

**Request:**
```json
{
  "jobId": "skills_1761279036851_j4eidq"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully",
  "jobId": "skills_1761279036851_j4eidq",
  "timestamp": "2025-10-24T10:30:00.000Z"
}
```

**What it does:**
1. Marks job as `manually_stopped`
2. Sets `monitoringActive: false`
3. Adds `stoppedAt` timestamp
4. Adds `stoppedReason: "User manually stopped the job (Ctrl+C)"`
5. Deletes job from both databases
6. Cleans up PendingUpload

## Usage

### Stopping a Job Manually

**Method 1: Press Ctrl+C in terminal**
```bash
# While backend is running with active job
^C  # Press Ctrl+C

# Output:
🛑 [DocumentAnalysisWithSkills] Marking job skills_xxx as manually stopped
🛑 Received SIGINT, starting graceful shutdown...
```

**Method 2: Call API endpoint**
```bash
curl -X POST http://localhost:3008/api/agent/cancel-skills-job \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jobId": "skills_1761279036851_j4eidq"}'
```

### Recovering from Crashed Jobs

If backend **crashes** (not manual Ctrl+C), jobs will auto-recover on restart:

```bash
# Start backend
npm start

# Output:
🚀 [SkillsJobRecovery] Running recovery check after backend restart...
🔍 [SkillsJobRecovery] Found 2 job(s) to recover
🔧 [SkillsJobRecovery] Recovering job skills_xxx...
```

**Recovery criteria:**
- Status: `pending` or `processing`
- Monitoring active: `true`
- Retry count: `< 3`
- Status: **NOT** `manually_stopped`

### Cleanup Script

One-time cleanup for existing stuck jobs:

```bash
cd apps/backend-api
node cleanup-stuck-jobs.js
```

**Output:**
```
🧹 [CleanupStuckJobs] Starting cleanup of stuck jobs...
🔍 [CleanupStuckJobs] Found 8 stuck job(s)
   🛑 Marking job skills_1761249410876_abdat as manually_stopped (was: processing)
   ...
✅ [CleanupStuckJobs] Cleanup complete - marked 8 job(s) as manually_stopped
📋 [CleanupStuckJobs] These jobs will NOT be recovered on next restart
```

## Implementation Details

### Files Modified

1. **documentAnalysisWithSkills.js**
   - Added `activeJobId` tracker
   - Added `gracefulShutdown()` method
   - Registered SIGINT/SIGTERM handlers
   - Clears activeJobId on completion/failure

2. **skillsJobTracker.js**
   - Added `markManuallyStopped()` method
   - Updated `updateJobStatus()` to delete manually_stopped jobs
   - Updated `getJobsForRecovery()` to exclude manually_stopped jobs

3. **routes/agent.js**
   - Added `POST /api/agent/cancel-skills-job` endpoint
   - Validation and error handling
   - Audit logging

4. **cleanup-stuck-jobs.js** (new file)
   - One-time cleanup script
   - Marks all existing stuck jobs as manually_stopped

### Database Changes

**New status value:** `manually_stopped`

**Fields added on manual stop:**
```javascript
{
  status: 'manually_stopped',
  monitoringActive: false,
  stoppedAt: new Date(),
  stoppedReason: 'User manually stopped the job (Ctrl+C)'
}
```

**Cleanup behavior:**
- `completed` jobs: Deleted immediately
- `manually_stopped` jobs: Deleted immediately
- `failed` jobs: Kept for debugging

## Testing

### Test 1: Manual Stop with Ctrl+C

```bash
# 1. Start backend
npm start

# 2. Upload a document to trigger Skills analysis
# (wait for job to start)

# 3. Press Ctrl+C
^C

# 4. Check logs - should see:
🛑 [DocumentAnalysisWithSkills] Marking job skills_xxx as manually stopped
🛑 Received SIGINT, starting graceful shutdown...

# 5. Restart backend
npm start

# 6. Check logs - should NOT see recovery for that job:
🚀 [SkillsJobRecovery] Running recovery check after backend restart...
✅ [SkillsJobRecovery] No jobs need recovery
```

### Test 2: Crash Recovery

```bash
# 1. Start backend
npm start

# 2. Upload a document to trigger Skills analysis

# 3. Kill backend forcefully (NOT Ctrl+C)
kill -9 <pid>

# 4. Restart backend
npm start

# 5. Check logs - SHOULD see recovery:
🚀 [SkillsJobRecovery] Running recovery check after backend restart...
🔍 [SkillsJobRecovery] Found 1 job(s) to recover
🔧 [SkillsJobRecovery] Recovering job skills_xxx...
```

### Test 3: API Endpoint

```bash
# 1. Get a running job ID from logs
# Look for: 📝 Registered job: skills_xxx

# 2. Call cancel endpoint
curl -X POST http://localhost:3008/api/agent/cancel-skills-job \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"jobId": "skills_xxx"}'

# 3. Check response
{
  "success": true,
  "message": "Job cancelled successfully",
  "jobId": "skills_xxx"
}

# 4. Check logs
🛑 [AGENT] Cancelling Skills job: skills_xxx
🛑 [SkillsJobTracker] Marking job skills_xxx as manually stopped
```

## Best Practices

### When to Use Manual Stop

✅ **Good reasons to stop:**
- Testing/debugging - you don't need the full result
- Wrong document uploaded
- Backend is being deployed
- You want to re-run with different settings

❌ **Bad reasons to stop:**
- Job is taking "too long" (normal: 60-120s)
- You think it's stuck (check logs first)
- Cost concerns (Jobs cost $0.01-0.05)

### Monitoring Active Jobs

Check global database for active jobs:

```bash
mongosh "<MONGODB_URI>" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_global');
  db.skills_job_metadata.find({
    monitoringActive: true
  }).forEach(j => print(j.jobId + ' - ' + j.status));
"
```

## Troubleshooting

### Job keeps restarting on backend restart

**Cause:** Job status is `pending` or `processing`

**Solution:** Run cleanup script or manually cancel:
```bash
node cleanup-stuck-jobs.js
# OR
curl -X POST .../cancel-skills-job -d '{"jobId": "skills_xxx"}'
```

### Ctrl+C doesn't stop the job

**Cause:** Job is running in Anthropic's cloud, we can only mark it as stopped

**Behavior:**
- Job will continue running in Anthropic's cloud
- We mark it as `manually_stopped` in our database
- It won't be recovered on restart
- PendingUpload is cleaned up
- You won't be charged twice (no retry)

### Recovery runs on every restart

**Expected:** Recovery ONLY runs once on startup, NOT periodically

**Reason:** Skills API calls can take 10+ minutes, so time-based recovery would incorrectly flag normal jobs as stuck

**Recovery triggers:**
- Backend restart (5 second delay)
- NOT periodic cron

## Architecture Decisions

### Why not cancel the actual API call?

**Problem:** No way to cancel a running Skills API request to Anthropic

**Solution:** We mark it as stopped in our database so:
1. We don't retry it
2. We don't charge the user twice
3. We clean up our resources
4. It doesn't auto-recover

### Why delete manually_stopped jobs immediately?

**Reason:** User explicitly cancelled them - they don't want to see them again

**Alternative considered:** Keep them for debugging → Rejected because:
- Users would be confused seeing old cancelled jobs
- It clutters the database
- Failed jobs are already kept for debugging

### Why not use a global "stop all jobs" flag?

**Reason:** Jobs can run concurrently from different users/practices

**Alternative:** Per-job control is more granular and flexible

## Future Enhancements

Potential improvements:

1. **Frontend UI** to show running jobs with cancel button
2. **Job progress tracking** (% complete estimation)
3. **Job priority queue** (process high-priority first)
4. **Concurrent job limit** (max N jobs at once)
5. **Auto-retry** for network failures only (not data errors)

## Summary

- ✅ Press Ctrl+C to stop running job gracefully
- ✅ Stopped jobs are marked `manually_stopped` and deleted
- ✅ Recovery SKIPS manually stopped jobs
- ✅ API endpoint for programmatic cancellation
- ✅ Cleanup script for existing stuck jobs
- ✅ Jobs only recover after **crash**, not manual stop
