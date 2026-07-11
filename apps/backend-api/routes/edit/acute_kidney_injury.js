/**
 * Acute Kidney Injury Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/acute_kidney_injury/:id/edit    — Edit a single field
 * PUT /api/edit/acute_kidney_injury/:id/approve — Approve all pending edits
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
    serviceId: 'acute-kidney-injury-edit-service',
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
  'stage', 'baselineCreatinine', 'peakCreatinine', 'urineOutput',
  'etiology', 'precipitants', 'fenA', 'feUrea', 'urinaryIndices',
  'recovery', 'dialysisRequired', 'date', 'provider', 'facility',
  'findings', 'results', 'assessment', 'plan',
  'notes', 'recommendations', 'status',
];

// Dotted-path prefixes permitted for nested OBJECT field edits
const ALLOWED_FIELD_PREFIXES = ['urinaryIndices.', 'results.'];

function isFieldAllowed(field) {
  if (ALLOWED_FIELDS.includes(field)) return true;
  return ALLOWED_FIELD_PREFIXES.some((prefix) => field.startsWith(prefix));
}

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!isFieldAllowed(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid acute kidney injury ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('acute_kidney_injury', { _id: objectId }, {
      $set: {
        [field]: value,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[AcuteKidneyInjury] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, approved } = req.body;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid acute kidney injury ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('acute_kidney_injury', { _id: objectId }, {
      $set: {
        [`approvedSections.${sectionId}`]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[AcuteKidneyInjury] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
