/**
 * Role Management Service
 * CRUD operations for custom roles + seed built-in roles into `roles` collection
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const { roleDescription } = require('../config/roles');

const COLLECTION = 'roles';

// Singleton service token (lazy-initialized on first use)
let _serviceToken = null;
async function getServiceToken() {
  if (!_serviceToken) {
    _serviceToken = await serviceAccountManager.authenticate('roleManagementService');
  }
  return _serviceToken;
}

// Built-in role catalog: EXACTLY the 4 canonical roles (admin, doctor, nurse, user).
// See config/roles.js — the single source of truth. No legacy roles are assignable.
const BUILT_IN_ROLES = [
  {
    name: 'admin',
    displayName: 'Admin',
    description: roleDescription('admin'),
    hierarchyLevel: 10,
    permissionsKey: 'all' // special: gets all permissions from catalog
  },
  {
    name: 'doctor',
    displayName: 'Doctor',
    description: roleDescription('doctor'),
    hierarchyLevel: 7,
    staticPermissions: [
      'read_patients', 'write_patients', 'read_documents', 'write_documents', 'export_patients'
    ],
    includeMedicalRead: true,
    includeMedicalWrite: true
  },
  {
    name: 'nurse',
    displayName: 'Nurse',
    description: roleDescription('nurse'),
    hierarchyLevel: 6,
    staticPermissions: [
      'read_patients', 'write_patients', 'read_documents'
    ],
    includeMedicalRead: true,
    includeMedicalWrite: true
  },
  {
    name: 'user',
    displayName: 'User',
    description: roleDescription('user'),
    hierarchyLevel: 2,
    staticPermissions: [
      'read_patients', 'read_documents'
    ],
    includeMedicalRead: false,
    includeMedicalWrite: false
  }
];

/**
 * Build the full permissions array for a built-in role definition
 */
function buildPermissions(roleDef) {
  const { catalog, getMedicalCollectionPermissions } = require('../rbac/permissionCatalog');

  // Admin gets everything
  if (roleDef.permissionsKey === 'all') {
    return catalog.map(p => p.id);
  }

  const perms = [...(roleDef.staticPermissions || [])];

  if (roleDef.includeMedicalRead || roleDef.includeMedicalWrite) {
    const medPerms = getMedicalCollectionPermissions();
    const readPerms = medPerms.filter(p => p.id.startsWith('read:')).map(p => p.id);
    const writePerms = medPerms.filter(p => p.id.startsWith('write:')).map(p => p.id);

    if (roleDef.includeMedicalRead === 'lab_only') {
      perms.push(...readPerms.filter(p =>
        p.includes('lab') || p.includes('diagnostic') || p.includes('pathology')
      ));
    } else if (roleDef.includeMedicalRead) {
      perms.push(...readPerms);
    }

    if (roleDef.includeMedicalWrite === true) {
      perms.push(...writePerms);
    }
  }

  return perms;
}

async function createContext(practiceContext, operation) {
  const token = await getServiceToken();
  return {
    serviceId: 'roleManagementService',
    operation,
    practiceId: practiceContext?.subdomain || practiceContext?.practiceId || 'global',
    apiKey: token?.apiKey || token
  };
}

// ─────────────────── public API ───────────────────

/**
 * Seed built-in roles into the roles collection (idempotent).
 * Called automatically by getRoles on first access.
 */
async function seedBuiltInRoles(practiceContext) {
  const ctx = await createContext(practiceContext, 'seed_built_in_roles');

  const existing = await SecureDataAccess.query(COLLECTION, {}, {}, ctx);
  if (existing && existing.length > 0) return; // already seeded

  const now = new Date();
  const docs = BUILT_IN_ROLES.map(def => ({
    name: def.name,
    displayName: def.displayName,
    description: def.description,
    hierarchyLevel: def.hierarchyLevel,
    permissions: buildPermissions(def),
    isSystem: true,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system'
  }));

  for (const doc of docs) {
    await SecureDataAccess.insert(COLLECTION, doc, ctx);
  }
}

/**
 * Get all roles (seeds on first call if collection empty).
 */
async function getRoles(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'get_roles');

  // Seed on first call
  await seedBuiltInRoles(practiceContext);

  const filter = { isDeleted: { $ne: true } };
  const roles = await SecureDataAccess.query(COLLECTION, filter, {}, ctx);

  return {
    success: true,
    message: isHebrew ? `נמצאו ${roles.length} תפקידים` : `Found ${roles.length} roles`,
    data: roles
  };
}

/**
 * Create a new custom role.
 */
async function createRole(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'create_role');

  if (!args.name || !args.displayName) {
    return {
      success: false,
      message: isHebrew ? 'נדרש שם תפקיד ושם תצוגה' : 'Role name and display name are required'
    };
  }

  // Normalize name
  const name = args.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Validate unique name
  const existing = await SecureDataAccess.query(COLLECTION, { name, isDeleted: { $ne: true } }, { limit: 1 }, ctx);
  if (existing && existing.length > 0) {
    return {
      success: false,
      message: isHebrew ? `תפקיד בשם "${name}" כבר קיים` : `Role "${name}" already exists`
    };
  }

  // Validate permissions against catalog
  const permissions = args.permissions || [];
  if (permissions.length > 0) {
    const { catalog } = require('../rbac/permissionCatalog');
    const validIds = new Set(catalog.map(p => p.id));
    const invalid = permissions.filter(p => !validIds.has(p));
    if (invalid.length > 0) {
      return {
        success: false,
        message: isHebrew
          ? `הרשאות לא חוקיות: ${invalid.join(', ')}`
          : `Invalid permissions: ${invalid.join(', ')}`
      };
    }
  }

  // Validate hierarchy level
  const hierarchyLevel = args.hierarchyLevel != null ? Number(args.hierarchyLevel) : 5;
  if (hierarchyLevel < 1 || hierarchyLevel > 10) {
    return {
      success: false,
      message: isHebrew ? 'רמת היררכיה חייבת להיות בין 1 ל-10' : 'Hierarchy level must be between 1 and 10'
    };
  }

  const now = new Date();
  const doc = {
    name,
    displayName: args.displayName,
    description: args.description || '',
    hierarchyLevel,
    permissions,
    isSystem: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdBy: practiceContext?.user?._id?.toString() || practiceContext?.user?.id || 'agent'
  };

  await SecureDataAccess.insert(COLLECTION, doc, ctx);

  return {
    success: true,
    message: isHebrew
      ? `תפקיד "${args.displayName}" נוצר בהצלחה`
      : `Role "${args.displayName}" created successfully`,
    data: doc
  };
}

/**
 * Update a custom role (blocks system role edits).
 */
async function updateRole(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'update_role');

  if (!args.roleName) {
    return { success: false, message: isHebrew ? 'נדרש שם תפקיד' : 'Role name is required' };
  }

  const roleName = args.roleName.toLowerCase().replace(/\s+/g, '_');
  const roles = await SecureDataAccess.query(COLLECTION, { name: roleName, isDeleted: { $ne: true } }, { limit: 1 }, ctx);
  if (!roles || roles.length === 0) {
    return { success: false, message: isHebrew ? 'תפקיד לא נמצא' : 'Role not found' };
  }

  const role = roles[0];
  if (role.isSystem) {
    return {
      success: false,
      message: isHebrew
        ? 'לא ניתן לעדכן תפקידי מערכת מובנים'
        : 'Cannot modify built-in system roles'
    };
  }

  const updateFields = { updatedAt: new Date() };
  if (args.displayName) updateFields.displayName = args.displayName;
  if (args.description !== undefined) updateFields.description = args.description;
  if (args.hierarchyLevel != null) {
    const level = Number(args.hierarchyLevel);
    if (level < 1 || level > 10) {
      return { success: false, message: isHebrew ? 'רמת היררכיה חייבת להיות בין 1 ל-10' : 'Hierarchy level must be between 1 and 10' };
    }
    updateFields.hierarchyLevel = level;
  }
  if (args.permissions) {
    const { catalog } = require('../rbac/permissionCatalog');
    const validIds = new Set(catalog.map(p => p.id));
    const invalid = args.permissions.filter(p => !validIds.has(p));
    if (invalid.length > 0) {
      return {
        success: false,
        message: isHebrew
          ? `הרשאות לא חוקיות: ${invalid.join(', ')}`
          : `Invalid permissions: ${invalid.join(', ')}`
      };
    }
    updateFields.permissions = args.permissions;
  }

  await SecureDataAccess.update(
    COLLECTION,
    { _id: role._id },
    { $set: updateFields },
    ctx
  );

  return {
    success: true,
    message: isHebrew
      ? `תפקיד "${role.displayName}" עודכן בהצלחה`
      : `Role "${role.displayName}" updated successfully`,
    data: { ...role, ...updateFields }
  };
}

/**
 * Soft-delete a custom role. Blocks deletion of system roles.
 * Optional reassignTo to move users to another role first.
 */
async function deleteRole(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'delete_role');

  if (!args.roleName) {
    return { success: false, message: isHebrew ? 'נדרש שם תפקיד' : 'Role name is required' };
  }

  const roleName = args.roleName.toLowerCase().replace(/\s+/g, '_');
  const roles = await SecureDataAccess.query(COLLECTION, { name: roleName, isDeleted: { $ne: true } }, { limit: 1 }, ctx);
  if (!roles || roles.length === 0) {
    return { success: false, message: isHebrew ? 'תפקיד לא נמצא' : 'Role not found' };
  }

  const role = roles[0];
  if (role.isSystem) {
    return {
      success: false,
      message: isHebrew
        ? 'לא ניתן למחוק תפקידי מערכת מובנים'
        : 'Cannot delete built-in system roles'
    };
  }

  // Check if any users have this role
  const usersWithRole = await SecureDataAccess.query(
    'users',
    { $or: [{ role: roleName }, { roleId: roleName }, { roles: roleName }] },
    {},
    ctx
  );

  if (usersWithRole && usersWithRole.length > 0) {
    if (!args.reassignTo) {
      return {
        success: false,
        message: isHebrew
          ? `לא ניתן למחוק - ${usersWithRole.length} משתמשים משויכים לתפקיד זה. ציין תפקיד חלופי עם reassignTo`
          : `Cannot delete - ${usersWithRole.length} user(s) assigned to this role. Specify a reassignTo role`
      };
    }

    // Verify reassignTo role exists
    const reassignName = args.reassignTo.toLowerCase().replace(/\s+/g, '_');
    const targetRoles = await SecureDataAccess.query(COLLECTION, { name: reassignName, isDeleted: { $ne: true } }, { limit: 1 }, ctx);
    if (!targetRoles || targetRoles.length === 0) {
      return { success: false, message: isHebrew ? `תפקיד יעד "${args.reassignTo}" לא נמצא` : `Target role "${args.reassignTo}" not found` };
    }

    // Reassign users
    for (const user of usersWithRole) {
      await SecureDataAccess.update(
        'users',
        { _id: user._id },
        { $set: { role: reassignName, roleId: reassignName, updatedAt: new Date() } },
        ctx
      );
    }
  }

  // Soft delete
  await SecureDataAccess.update(
    COLLECTION,
    { _id: role._id },
    { $set: { isDeleted: true, updatedAt: new Date() } },
    ctx
  );

  return {
    success: true,
    message: isHebrew
      ? `תפקיד "${role.displayName}" נמחק בהצלחה`
      : `Role "${role.displayName}" deleted successfully`
  };
}

/**
 * List all permissions from the permission catalog, grouped by category.
 */
async function listAllPermissions(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const { catalog } = require('../rbac/permissionCatalog');

  // Group by category
  const grouped = {};
  for (const perm of catalog) {
    const group = perm.group || 'other';
    if (args.group && group !== args.group) continue;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({
      id: perm.id,
      name: perm.name,
      description: perm.description,
      implemented: perm.implemented
    });
  }

  const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return {
    success: true,
    message: isHebrew
      ? `${totalCount} הרשאות ב-${Object.keys(grouped).length} קבוצות`
      : `${totalCount} permissions in ${Object.keys(grouped).length} groups`,
    data: grouped
  };
}

/**
 * Clone an existing role into a new custom role.
 */
async function cloneRole(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'clone_role');

  if (!args.sourceRoleName || !args.newName) {
    return {
      success: false,
      message: isHebrew ? 'נדרש שם תפקיד מקור ושם חדש' : 'Source role name and new name are required'
    };
  }

  // Ensure roles are seeded
  await seedBuiltInRoles(practiceContext);

  const sourceName = args.sourceRoleName.toLowerCase().replace(/\s+/g, '_');
  const sourceRoles = await SecureDataAccess.query(COLLECTION, { name: sourceName, isDeleted: { $ne: true } }, { limit: 1 }, ctx);
  if (!sourceRoles || sourceRoles.length === 0) {
    return { success: false, message: isHebrew ? 'תפקיד מקור לא נמצא' : 'Source role not found' };
  }

  const source = sourceRoles[0];

  // Create via createRole to reuse validation
  return await createRole({
    name: args.newName,
    displayName: args.newDisplayName || args.newName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: args.description || `Cloned from ${source.displayName}`,
    hierarchyLevel: args.hierarchyLevel || source.hierarchyLevel,
    permissions: source.permissions
  }, practiceContext, session);
}

/**
 * Copy permissions from one user to another.
 */
async function cloneUserPermissions(args, practiceContext, session) {
  const isHebrew = session?.language === 'he';
  const ctx = await createContext(practiceContext, 'clone_user_permissions');

  if (!args.sourceEmail || !args.targetEmail) {
    return {
      success: false,
      message: isHebrew ? 'נדרש אימייל משתמש מקור ואימייל משתמש יעד' : 'Source email and target email are required'
    };
  }

  // Find source user by email
  const sourceUsers = await SecureDataAccess.query(
    'users',
    { email: args.sourceEmail.toLowerCase().trim() },
    { limit: 1, projection: { permissions: 1, role: 1, firstName: 1, lastName: 1, email: 1 } },
    ctx
  );

  if (!sourceUsers || sourceUsers.length === 0) {
    return { success: false, message: isHebrew ? `משתמש מקור ${args.sourceEmail} לא נמצא` : `Source user ${args.sourceEmail} not found` };
  }

  // Find target user by email
  const targetUsers = await SecureDataAccess.query(
    'users',
    { email: args.targetEmail.toLowerCase().trim() },
    { limit: 1, projection: { _id: 1, email: 1 } },
    ctx
  );

  if (!targetUsers || targetUsers.length === 0) {
    return { success: false, message: isHebrew ? `משתמש יעד ${args.targetEmail} לא נמצא` : `Target user ${args.targetEmail} not found` };
  }

  const sourceUser = sourceUsers[0];
  const permissions = sourceUser.permissions || [];

  // Update target user
  await SecureDataAccess.update(
    'users',
    { _id: targetUsers[0]._id },
    { $set: { permissions, updatedAt: new Date() } },
    ctx
  );

  const sourceName = [sourceUser.firstName, sourceUser.lastName].filter(Boolean).join(' ') || args.sourceEmail;

  return {
    success: true,
    message: isHebrew
      ? `${permissions.length} הרשאות הועתקו מ-${sourceName} למשתמש יעד`
      : `${permissions.length} permissions copied from ${sourceName} to target user`,
    data: { permissionsCopied: permissions.length, permissions }
  };
}

module.exports = {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  listAllPermissions,
  cloneRole,
  cloneUserPermissions,
  seedBuiltInRoles
};
