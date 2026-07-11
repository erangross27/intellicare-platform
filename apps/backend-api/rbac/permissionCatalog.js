// Central permission catalog for IntelliCare
// Each permission has: id, group, name (i18n-friendly keys), description, implemented

const catalog = [
  // Patients
  { id: 'read_patients', group: 'patients', name: 'Read Patients', description: 'View patient demographics and clinical data', implemented: true },
  { id: 'write_patients', group: 'patients', name: 'Write Patients', description: 'Create or update patient data and visits', implemented: true },
  { id: 'delete_patients', group: 'patients', name: 'Delete Patients', description: 'Delete patient records (soft delete)', implemented: true },
  { id: 'export_patients', group: 'patients', name: 'Export Patients', description: 'Export patient data (CSV/JSON)', implemented: true },

  // Documents
  { id: 'read_documents', group: 'documents', name: 'Read Documents', description: 'View uploaded documents', implemented: true },
  { id: 'write_documents', group: 'documents', name: 'Write Documents', description: 'Edit document metadata and content', implemented: true },
  { id: 'upload_documents', group: 'documents', name: 'Upload Documents', description: 'Upload new medical documents', implemented: true },
  { id: 'delete_documents', group: 'documents', name: 'Delete Documents', description: 'Delete documents (soft delete)', implemented: true },
  { id: 'export_documents', group: 'documents', name: 'Export Documents', description: 'Export documents metadata', implemented: true },

  // Users & Admin
  { id: 'manage_users', group: 'admin', name: 'Manage Users', description: 'Create, edit, and deactivate users', implemented: true },
  { id: 'assign_roles', group: 'admin', name: 'Assign Roles', description: 'Assign roles to users', implemented: true },
  { id: 'view_reports', group: 'analytics', name: 'View Reports', description: 'Access reporting dashboards', implemented: false },
  { id: 'system_admin', group: 'admin', name: 'System Admin', description: 'Full administrative access', implemented: true },

  // Practice Config
  { id: 'manage_practice_settings', group: 'practice', name: 'Manage Practice Settings', description: 'Update practice configuration', implemented: true },
  { id: 'manage_billing', group: 'billing', name: 'Manage Billing', description: 'Billing, insurance, and finances', implemented: false },
  { id: 'view_audit_logs', group: 'compliance', name: 'View Audit Logs', description: 'View HIPAA audit logs', implemented: true },

  // Orders/Labs (future)
  { id: 'orders_create', group: 'orders', name: 'Create Orders', description: 'Create lab/radiology orders', implemented: false },
  { id: 'orders_manage_results', group: 'orders', name: 'Manage Results', description: 'Enter and validate lab results', implemented: false },
];

/**
 * Generate medical collection permissions dynamically
 * Each collection gets read:collection and write:collection permissions
 */
function getMedicalCollectionPermissions() {
  const medicalCollectionsService = require('../services/medicalCollectionsService');
  const allCollections = medicalCollectionsService.getAllCollections();

  const permissions = [];
  for (const collection of allCollections) {
    permissions.push(
      {
        id: `read:${collection}`,
        group: 'medical_data',
        name: `Read ${collection}`,
        description: `View ${collection} medical data`,
        implemented: true
      },
      {
        id: `write:${collection}`,
        group: 'medical_data',
        name: `Write ${collection}`,
        description: `Create/update ${collection} medical data`,
        implemented: true
      }
    );
  }

  return permissions;
}

/**
 * Get full permission catalog including medical collections
 */
function getFullCatalog() {
  return [...catalog, ...getMedicalCollectionPermissions()];
}

function getPermissionIds() {
  return getFullCatalog().map(p => p.id);
}

module.exports = {
  catalog: getFullCatalog(),
  getPermissionIds,
  getMedicalCollectionPermissions
};

