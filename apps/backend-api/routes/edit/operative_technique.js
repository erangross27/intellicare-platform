/**
 * Operative Technique Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/operative_technique/:id/edit    — Edit a single field
 * PUT /api/edit/operative_technique/:id/approve — Approve a section
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

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'operative-technique-edit-service',
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

const ALLOWED_FIELDS = [
  'stepByStep', 'criticalSteps', 'hemostasis', 'irrigation',
  'drains', 'closure', 'date', 'type', 'provider', 'facility',
  'findings', 'assessment', 'plan', 'notes', 'recommendations', 'status',
  'results',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field) {
      return res.status(400).json({ success: false, error: 'field is required' });
    }

    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) {
      return res.status(400).json({ success: false, error: `Field "${parentField}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid operative technique ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    let updatePath = field;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updatePath = `${field}.${arrayIndex}`;
    }

    const result = await sda.update(
      'operative_technique',
      { _id: objectId },
      {
        $set: {
          [updatePath]: value,
          [`doctorEdits.${field}`]: {
            value,
            editedAt: new Date(),
            editedBy: req.user?.id || 'doctor',
          },
        },
      },
      context
    );

    return res.json({ success: result.modifiedCount > 0, recordId: id, editedField: field });
  } catch (err) {
    console.error('[OperativeTechnique] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId } = req.body;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid operative technique ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const result = await sda.update(
      'operative_technique',
      { _id: objectId },
      {
        $set: {
          [`doctorEdits.approvedSections.${sectionId}`]: {
            approved: true,
            approvedAt: new Date(),
            approvedBy: req.user?.id || 'doctor',
          },
        },
      },
      context
    );

    return res.json({ success: result.modifiedCount > 0, recordId: id, sectionId, status: 'approved' });
  } catch (err) {
    console.error('[OperativeTechnique] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
