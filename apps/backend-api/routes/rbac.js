const express = require('express');
const SecureDataAccess = require('../services/secureDataAccess');
const router = express.Router();
const { fullClinicAuth, requireRole } = require('../middleware/practiceAuth');
const { catalog } = require('../rbac/permissionCatalog');
const { getDefaultRoleMap } = require('../rbac/rbacService');

// Get permission catalog (for UI), include implemented flag
router.get('/catalog', [fullClinicAuth, requireRole(['admin'])], async (req, res) => {
  res.json({ success: true, catalog });
});

// Get current practice RBAC policy (roles -> permissions)
router.get('/policy', [fullClinicAuth, requireRole(['admin'])], async (req, res) => {
  // Define proper context for SecureDataAccess
  const context = {
    serviceId: 'rbac-service',
    apiKey: req.headers['x-api-key'],
    practiceId: req.practice.id
  };
  
  const policies = await SecureDataAccess.query('policies', {}, { limit: 1 }, context);
  let doc = policies && policies.length > 0 ? policies[0] : null;
  if (!doc) {
    // Initialize with defaults for convenience
    doc = await Policy.create({ roles: getDefaultRoleMap(), updatedBy: req.user.id });
  }
  res.json({ success: true, policy: doc });
});

// Update practice RBAC policy
router.put('/policy', [fullClinicAuth, requireRole(['admin'])], async (req, res) => {
  // Define proper context for SecureDataAccess
  const context = {
    serviceId: 'rbac-service',
    apiKey: req.headers['x-api-key'],
    practiceId: req.practice.id
  };
  
  const { roles } = req.body; // [{roleId, permissions:[]},...]
  if (!Array.isArray(roles)) return res.status(400).json({ success: false, message: 'roles array required' });

  const policies = await SecureDataAccess.query('policies', {}, { limit: 1 }, context);
  let doc = policies && policies.length > 0 ? policies[0] : null;
  if (!doc) {
    doc = { roles: getDefaultRoleMap(), updatedBy: req.user.id, createdAt: new Date() };
  }
  doc.roles = roles;
  doc.updatedAt = new Date();
  doc.updatedBy = req.user.id;
  if (doc._id) {
    await SecureDataAccess.update('policies', { _id: doc._id }, { $set: { roles: doc.roles, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy } }, context);
  } else {
    doc = await SecureDataAccess.insert('policies', doc, context);
  }
  res.json({ success: true, policy: doc });
});

module.exports = router;

