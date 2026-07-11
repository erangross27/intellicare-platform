# Task 03: Add Custom Role Management Tools

## Priority: MEDIUM
## Category: Phase 1 - Wire Existing Services
## Dependencies: None

## Background

The agent can assign/remove existing roles and view permissions, but cannot create new custom roles, update role definitions, or delete roles. The RBAC service (`rbacService.js`) has a hardcoded role hierarchy with 12 predefined roles. Practices may need custom roles (e.g., "Medical Assistant", "Physical Therapist", "Practice Manager").

## What Already Exists

### rbacService.js
Location: `apps/backend-api/services/rbacService.js`
- Defines role hierarchy: admin(10), medical_director(9), compliance_officer(8), doctor(7), doctor_specialist(7), nurse_rn(6), nurse_lpn(5), lab_tech(4), secretary(3), billing(3), receptionist(2), patient(1), guest(0)
- Each role has predefined permissions (e.g., admin gets `manage_users`, `system_admin`)
- Functions: `validateAccessRequest()`, `checkPermission()`, `hasRole()`, `getRolePermissions()`, `checkResourceAccess()`

### Agent Tools Already Defined
- `updateUserPermissions` - Update individual user permissions
- `addUserRole` / `removeUserRole` - Assign/remove roles
- `getRoles` - List available roles
- `getUserPermissions` - View user permissions
- `assignRole` - Assign role (duplicate of addUserRole?)
- `bulkUpdateRoles` - Bulk role changes

### userService.js
Location: `apps/backend-api/services/userService.js`
- Handles user creation, role assignment
- Stores roles in user document in MongoDB

## What Needs to Be Done

### Step 1: Add Role CRUD to rbacService.js (or new roleService.js)

Create functions:
- `createRole(name, displayName, permissions, hierarchyLevel)` - Create custom role
  - Validate name is unique
  - Validate permissions are from a known list
  - hierarchyLevel determines what data this role can access
  - Store in a `roles` collection in MongoDB
- `updateRole(roleId, updates)` - Update role name, permissions, level
  - Cannot modify built-in roles (admin, doctor, etc.) - only custom ones
  - When permissions change, optionally propagate to all users with that role
- `deleteRole(roleId)` - Delete custom role
  - Cannot delete built-in roles
  - Check no users currently have this role (or reassign them first)
  - Soft delete with confirmation
- `listAllPermissions()` - List all possible permissions in the system
  - Extract from existing role definitions
  - Group by category (medical, admin, billing, system)
- `cloneRole(sourceRoleId, newName)` - Copy permissions from one role to create another
  - Useful for creating variations (e.g., clone "nurse_rn" to create "medical_assistant")

### Step 2: Migrate Roles to Database
Currently roles are hardcoded in rbacService.js. To support custom roles:
- Seed the 12 built-in roles into a `roles` collection on startup
- Mark built-in roles as `isSystem: true` (cannot be deleted/modified)
- Custom roles get `isSystem: false`
- Update `checkPermission()` to read from database instead of hardcoded object

### Step 3: Add Tool Definitions to aiHelpers.js
Add schemas for:
- `createRole` - name, displayName, permissions (array), hierarchyLevel (1-10), description
- `updateRole` - roleId, displayName, permissions, hierarchyLevel
- `deleteRole` - roleId, reassignTo (optional - move users to this role first)
- `listAllPermissions` - No required params, optional category filter
- `cloneRole` - sourceRoleName, newName, newDisplayName
- `cloneUserPermissions` - sourceUserId, targetUserId

### Step 4: Add Case Routes in agentServiceV4.js
Wire the new functions.

### Step 5: Test via Chat
- "Create a new role called Medical Assistant with read access to patient records and vitals"
- "What permissions does the nurse_rn role have?"
- "Clone the nurse role and create a Physical Therapist role"
- "List all available permissions in the system"
- "Delete the Medical Assistant role and reassign users to nurse_lpn"
- "Copy Dr. Smith's permissions to Dr. Jones"

## Files to Modify
1. `apps/backend-api/services/rbacService.js` - New CRUD functions (or create roleService.js)
2. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
3. `apps/backend-api/services/agentServiceV4.js` - Case routes
4. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Keywords

## Notes
- Built-in roles must remain immutable (isSystem: true)
- Consider audit logging for all role changes (HIPAA requirement)
- The permission sync service (`permissionSyncService.js`) may need updates to handle custom roles
