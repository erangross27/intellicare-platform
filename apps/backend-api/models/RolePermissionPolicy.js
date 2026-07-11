const mongoose = require('mongoose');

// Per-practice role→permissions policy
// Allows practice-specific overrides of which permissions each role grants

const RolePermissionPolicySchema = new mongoose.Schema({
  roleId: { type: String, required: true },
  permissions: [{ type: String }],
}, { _id: false });

const ClinicRBACPolicySchema = new mongoose.Schema({
  // One document per practice DB
  policyVersion: { type: Number, default: 1 },
  roles: [RolePermissionPolicySchema],
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

function createModel(practiceDb) {
  if (practiceDb.models.ClinicRBACPolicy) return practiceDb.models.ClinicRBACPolicy;
  return practiceDb.model('ClinicRBACPolicy', ClinicRBACPolicySchema);
}

module.exports = { schema: ClinicRBACPolicySchema, createModel };

