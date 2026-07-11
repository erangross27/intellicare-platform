# Task 20: Add Internal Claim Tracking

## Priority: LOW
## Category: Phase 4 - Agent Capability Gaps
## Dependencies: Task 01 (Billing Service wired to agent)

## Background

Even without external clearinghouse submission, practices need to track claims internally - which claims were generated, their status (draft, ready, submitted, paid, denied), and follow up on outstanding claims. This is internal bookkeeping that doesn't require a business ID or external APIs.

## What Already Exists

### billingService.js
- `generateClaim(chargeId)` - Creates internal claim record
- `submitBatchClaims(claims)` - Batch processing
- No status tracking or lifecycle management

## What Needs to Be Done

### Step 1: Add Claim Lifecycle Management
In billingService.js or new claimTrackingService.js:
- `createClaim(patientId, charges, diagnosisCodes, procedureCodes)` - Create claim
- `updateClaimStatus(claimId, status, notes)` - Update status
  - Statuses: draft → ready → submitted → pending → paid/denied/appealed
- `getClaimsByStatus(status)` - Filter by status
- `getPatientClaims(patientId)` - All claims for a patient
- `getClaimAging()` - How old are unpaid claims (30/60/90/120 days)
- `addClaimNote(claimId, note)` - Add follow-up note
- `getClaimsDashboard()` - Summary: total by status, aging, amounts

### Step 2: Add Agent Tools
- `trackClaim` - "Track a claim through its lifecycle"
- `getClaimStatus` - "Check the status of a specific claim"
- `getUnpaidClaims` - "Show all unpaid/outstanding claims"
- `getClaimAging` - "Show claim aging report (30/60/90/120 days)"
- `updateClaimStatus` - "Update a claim status (e.g., mark as paid, denied)"
- `getClaimsDashboard` - "Show billing dashboard with claim summaries"

### Step 3: Test via Chat
- "Show me all pending claims"
- "How many claims are over 90 days old?"
- "Mark claim #456 as paid - check received"
- "Show me the billing dashboard"
- "Add a note to claim #789 - called insurance, awaiting response"

## Files to Modify
1. `apps/backend-api/services/billingService.js` - Add claim lifecycle functions
2. Standard agent wiring files

## Notes
- This is purely internal tracking (no external submission)
- Useful for practices that submit claims manually (paper or portal)
- The aging report helps identify revenue leakage
- When/if clearinghouse access is added later, this status system will integrate with real claim responses
