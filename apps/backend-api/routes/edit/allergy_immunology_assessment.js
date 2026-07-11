/**
 * Allergy Immunology Assessment Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/allergy_immunology_assessment/:id/edit    — Edit a single field
 * PUT /api/edit/allergy_immunology_assessment/:id/approve — Approve a section
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
  'type',
  'provider',
  'facility',
  'status',
  'findings',
  'assessment',
  'plan',
  'notes',
  'recommendations',
  'immuneFunction',
  'skinTesting',
  'specificIge',
  'componentTesting',
  'challengeTests',
  'results',
];

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'allergy-immunology-assessment-edit-service',
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
    const { field, value } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('allergy_immunology_assessment', { _id: objectId }, {
      $set: {
        [field]: value,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[AllergyImmunologyAssessment] PUT /:id/edit error:', err.message);
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

    await sda.update('allergy_immunology_assessment', { _id: objectId }, {
      $set: {
        [`approvedSections.${sectionId}`]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[AllergyImmunologyAssessment] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
