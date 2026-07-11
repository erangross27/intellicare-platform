# Task 05: Add Missing Permission Tools

## Priority: MEDIUM
## Category: Phase 1 - Wire Existing Services
## Dependencies: Task 03 (Role Management) for full functionality

## Background

The agent can assign roles and view permissions but lacks tools to list all available permissions, compare user permissions, and audit permission usage. These are needed for practice administrators managing staff access.

## What Already Exists

### Agent Tools
- `updateUserPermissions` - Update individual permissions
- `addUserRole` / `removeUserRole` - Role assignment
- `getRoles` - List roles
- `getUserPermissions` - View user permissions
- `assignRole` - Assign role
- `bulkUpdateRoles` - Bulk changes
- `getClinicPermissions` - Practice-level permissions

### rbacService.js
- Full permission definitions per role
- `checkPermission()`, `hasRole()`, `getRolePermissions()`, `checkResourceAccess()`
- `grantTemporaryPermission()` - Time-limited access

### Audit System
- `immutableAuditService.js` - Tracks all access
- `securityAuditService.js` - Security events

## What Needs to Be Done

### Step 1: Add New Tool Definitions
- `listAllPermissions` - Show every permission in the system, grouped by category (medical, admin, billing, system)
- `compareUserPermissions` - Compare two users' permissions side by side, show differences
- `cloneUserPermissions` - Copy all permissions from one user to another
- `grantTemporaryAccess` - Give a user temporary permission (e.g., "give nurse X access to billing for 24 hours")
- `revokeTemporaryAccess` - Remove temporary permission early
- `getPermissionAuditLog` - Who accessed what, when (HIPAA audit trail)
- `getUsersWithPermission` - "Who has access to patient records?" - list all users with a specific permission

### Step 2: Implement Backend Functions
Some of these may need new functions in rbacService.js or a new permissionService.js:
- `comparePermissions(userId1, userId2)` - Returns diff
- `clonePermissions(sourceUserId, targetUserId)` - Copies permissions
- `getUsersWithPermission(permissionName)` - Reverse lookup
- `getPermissionAuditLog(userId, dateRange)` - Query audit service

### Step 3: Wire to Agent
Add case routes in agentServiceV4.js.

### Step 4: Test via Chat
- "List all available permissions in the system"
- "Compare Dr. Smith's permissions with Dr. Jones"
- "Copy Dr. Smith's permissions to the new doctor Dr. Williams"
- "Give nurse Mary temporary access to billing for 48 hours"
- "Who has access to patient records?"
- "Show me the permission audit log for last week"

## Files to Modify
1. `apps/backend-api/services/rbacService.js` - New functions
2. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
3. `apps/backend-api/services/agentServiceV4.js` - Case routes
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords

## Notes
- Temporary access is important for covering shifts, emergencies
- Permission audit logs are a HIPAA requirement
- The reverse lookup ("who has access to X") is critical for compliance audits
