# RBAC Medical Permissions System

## Overview
The system automatically grants appropriate medical collection permissions to users based on their role.

## Role-Based Medical Access

### Admin
- **Access**: ALL medical collections (read + write)
- **Permissions**: All 1,438 permissions (719 × 2)
- **Use Case**: Full system access

### Medical Director
- **Access**: ALL medical collections (read + write)
- **Permissions**: All 1,438 medical permissions + management permissions
- **Use Case**: Clinical leadership + administrative oversight

### Doctor & Doctor Specialist
- **Access**: ALL medical collections (read + write)
- **Permissions**: All 1,438 medical permissions
- **Use Case**: Full clinical documentation and patient care

### Nurse RN
- **Access**: ALL medical collections (read + write)
- **Permissions**: All 1,438 medical permissions
- **Use Case**: Patient care documentation, vital signs, medications, etc.

### Nurse LPN
- **Access**: ALL medical collections (read only)
- **Permissions**: 719 read permissions
- **Use Case**: View patient data, cannot modify

### Secretary
- **Access**: ALL medical collections (read only)
- **Permissions**: 719 read permissions
- **Use Case**: Administrative tasks, scheduling, viewing records

### Billing
- **Access**: NO medical data access
- **Permissions**: Only `manage_billing`
- **Use Case**: Billing and insurance only

### Lab Tech
- **Access**: Lab-related medical collections (read only)
- **Permissions**: Read permissions for lab_results, diagnostic_studies, pathology_reports, etc.
- **Use Case**: Lab result entry and viewing

## How It Works

### 1. Permission Catalog (Auto-Generated)
**File**: `rbac/permissionCatalog.js`

Dynamically generates permissions for all 719 medical collections:
- `read:collection_name` - View data
- `write:collection_name` - Create/update data

### 2. Role Mapping (Auto-Assigned)
**File**: `rbac/rbacService.js`

When a new user is created, their role determines their permissions:

```javascript
// Example: Creating a doctor
POST /api/users
{
  "email": "doctor@example.com",
  "roles": ["doctor"],
  "profile": { ... }
}

// Result: User gets 1,438+ permissions automatically:
// - read_patients, write_patients, read_documents, write_documents, export_patients
// - read:providers, write:providers
// - read:allergies, write:allergies
// - read:diagnoses, write:diagnoses
// ... (all 719 collections × 2)
```

### 3. New Collection Handling

When a new medical collection is added:
1. Add to `medicalCollectionsService.js`
2. **Permissions auto-generated** by `permissionCatalog.js`
3. **Auto-assigned to roles** via `rbacService.js`
4. **No manual configuration needed!** ✅

## Verification

Check a user's permissions:
```javascript
const { getEffectivePermissions } = require('./rbac/rbacService');
const permissions = await getEffectivePermissions({
  practiceDb: req.practiceDb,
  roles: ['doctor']
});

console.log(permissions.length); // ~1450+ permissions
```

## Permission Format

- **Basic permissions**: `read_patients`, `write_documents`, `manage_users`
- **Medical collections**: `read:collection_name`, `write:collection_name`
  - Example: `read:providers`, `write:medications`, `read:lab_results`

## Security Notes

✅ **Role-based access control (RBAC)** enforced at middleware level
✅ **Practice isolation** - Users only see data from their practice
✅ **Granular permissions** - Different roles get different access levels
✅ **Automatic updates** - New collections automatically get permissions
✅ **Audit trail** - All permission checks logged

## Troubleshooting

### User getting 403 Forbidden on medical routes?
1. Check user's role: `db.users.findOne({ email: "user@example.com" })`
2. Verify permissions include medical collections: Should see `read:providers`, etc.
3. If missing, the user was created before this system was implemented
4. **Fix**: Run permission sync or recreate user

### New medical collection not accessible?
1. Verify collection is in `medicalCollectionsService.js`
2. Check permission catalog generates it: `getMedicalCollectionPermissions()`
3. Server restart may be needed to reload permission catalog
