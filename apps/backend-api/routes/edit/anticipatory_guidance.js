/**
 * Anticipatory Guidance Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 * Supports dot-path field names for nested objects (e.g., 'sleep.hoursRecommended')
 *
 * PUT /api/edit/anticipatory_guidance/:id/edit    — Edit a single field
 * PUT /api/edit/anticipatory_guidance/:id/approve — Approve a section
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

let secureDataAccess;
function getSecureDataAccess() {
  if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess');
  return secureDataAccess;
}

router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

const ALLOWED_FIELDS = [
  'date',
  'provider',
  'facility',
  'nutrition',
  'physicalActivity',
  'screenTime',
  'sleep',
  'safety',
  'dental',
  'socialDevelopment',
  'toileting',
  'discipline',
  'findings',
  'assessment',
  'plan',
  'results',
  'recommendations',
  'notes',
  'type',
];

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'anticipatory-guidance-edit-service',
    userId: req.user?.id,
    operation,
    practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId,
    permissions: [operation === 'read' ? 'read' : 'write'],
  };
}

function toObjectId(str) {
  try {
    return new mongoose.Types.ObjectId(str);
  } catch {
    return null;
  }
}

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Validate top-level field (supports dot-path like 'sleep.hoursRecommended')
    const topLevelField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(topLevelField)) {
      return res.status(400).json({ success: false, error: `Field "${topLevelField}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Build update path — supports dot-path and array index
    let updatePath = field;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updatePath = `${field}.${arrayIndex}`;
    }

    await sda.update('anticipatory_guidance', { _id: objectId }, {
      $set: {
        [updatePath]: value,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[AnticipatoryGuidance] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, approved } = req.body;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('anticipatory_guidance', { _id: objectId }, {
      $set: {
        [`approvedSections.${sectionId}`]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, approved });
  } catch (err) {
    console.error('[AnticipatoryGuidance] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
