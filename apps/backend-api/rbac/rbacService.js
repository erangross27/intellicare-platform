const { catalog } = require('./permissionCatalog');

/**
 * RBAC Service: computes effective permissions for a set of roles
 * Policy structure:
 *   ClinicRBACPolicy.roles = [{ roleId, permissions: [permId, ...] }]
 */
async function getEffectivePermissions({ practiceDb, roles }) {
  const Policy = require('../models/RolePermissionPolicy').createModel(practiceDb);
  const doc = await Policy.findOne();

  // Default baseline mapping if no policy exists yet
  const defaultMap = getDefaultRoleMap();
  const roleMap = new Map(defaultMap.map(r => [r.roleId, new Set(r.permissions)]));

  if (doc && Array.isArray(doc.roles)) {
    for (const r of doc.roles) {
      roleMap.set(r.roleId, new Set(r.permissions || []));
    }
  }

  const perms = new Set();
  for (const role of roles || []) {
    const set = roleMap.get(role);
    if (set) for (const p of set) perms.add(p);
  }
  return Array.from(perms);
}

function getDefaultRoleMap() {
  // Get all medical collection permissions
  const { getMedicalCollectionPermissions } = require('./permissionCatalog');
  const medicalPermissions = getMedicalCollectionPermissions();

  // Separate read and write permissions
  const allMedicalReadPermissions = medicalPermissions
    .filter(p => p.id.startsWith('read:'))
    .map(p => p.id);

  const allMedicalWritePermissions = medicalPermissions
    .filter(p => p.id.startsWith('write:'))
    .map(p => p.id);

  // Opinionated defaults aligned with current app
  const id = s => s; // helper
  return [
    // Admin: ALL permissions including all medical collections
    {
      roleId: 'admin',
      permissions: catalog.map(p => id(p.id))  // catalog already includes medical permissions
    },

    // Medical Director: Full medical access + management permissions
    {
      roleId: 'medical_director',
      permissions: [
        'read_patients','write_patients','delete_patients','export_patients',
        'read_documents','write_documents','delete_documents','export_documents',
        'manage_users','assign_roles','view_audit_logs','manage_practice_settings',
        ...allMedicalReadPermissions,
        ...allMedicalWritePermissions
      ]
    },

    // Doctor: Full medical read/write access
    {
      roleId: 'doctor',
      permissions: [
        'read_patients','write_patients','read_documents','write_documents','export_patients',
        ...allMedicalReadPermissions,
        ...allMedicalWritePermissions
      ]
    },

    // Nurse (canonical): clinical documentation read/write
    {
      roleId: 'nurse',
      permissions: [
        'read_patients','write_patients','read_documents',
        ...allMedicalReadPermissions,
        ...allMedicalWritePermissions  // Can document patient care
      ]
    },

    // User (canonical): basic read-only access to patients and documents
    {
      roleId: 'user',
      permissions: [
        'read_patients','read_documents'
      ]
    },

    // Doctor Specialist: Full medical read, limited write
    {
      roleId: 'doctor_specialist',
      permissions: [
        'read_patients','write_patients','read_documents',
        ...allMedicalReadPermissions,
        ...allMedicalWritePermissions  // Can write medical data
      ]
    },

    // Nurse RN: Full medical read, limited write
    {
      roleId: 'nurse_rn',
      permissions: [
        'read_patients','write_patients','read_documents',
        ...allMedicalReadPermissions,
        ...allMedicalWritePermissions  // Can document patient care
      ]
    },

    // Nurse LPN: Read-only medical access
    {
      roleId: 'nurse_lpn',
      permissions: [
        'read_patients','read_documents',
        ...allMedicalReadPermissions
      ]
    },

    // Secretary: Read-only medical access
    {
      roleId: 'secretary',
      permissions: [
        'read_patients','read_documents',
        ...allMedicalReadPermissions
      ]
    },

    // Billing: No medical data access
    {
      roleId: 'billing',
      permissions: [
        'manage_billing'
      ]
    },

    // Lab Tech: Read lab-related medical data only
    {
      roleId: 'lab_tech',
      permissions: [
        'orders_manage_results',
        ...allMedicalReadPermissions.filter(p =>
          p.includes('lab') || p.includes('diagnostic') || p.includes('pathology')
        )
      ]
    }
  ];
}

module.exports = { getEffectivePermissions, getDefaultRoleMap };

