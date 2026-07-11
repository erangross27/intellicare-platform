/**
 * Endoscopy Reports Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/endoscopy_reports/:id/edit    — Edit a single field
 * PUT /api/edit/endoscopy_reports/:id/approve — Approve all pending edits
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

// Lazy-loaded service
let secureDataAccess;
function getSecureDataAccess() {
  if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess');
  return secureDataAccess;
}

// Middleware: context → models → auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'endoscopy-reports-edit-service',
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

// Allowed editable fields for endoscopy_reports
const ALLOWED_FIELDS = [
  'procedureType', 'indicationForProcedure', 'sedationType', 'endoscopeType',
  'completenessOfExamination', 'procedureDuration',
  'bowelPreparation', 'cecalIntubationAchieved', 'withdrawalTime',
  'retroflexionPerformed', 'adenomaDetectionRate',
  'esophagitis', 'barrettEsophagus', 'varicesGrade', 'mucosal',
  'polypectomyPerformed',
  'biopsyLocations', 'polypsDetected', 'therapeuticInterventions',
  'complications', 'anatomicalLandmarks', 'photodocumentation',
  'helicobacterPyloriTesting', 'followUpRecommendations',
];

// ─── PUT /:id/edit — Edit a single field ──────────────────────────────────────

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, sentenceIdx } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid endoscopy report ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const setFields = {
      [field]: value,
      updatedAt: new Date(),
      updatedBy: req.user?.id,
    };

    await sda.update('endoscopy_reports', { _id: objectId }, {
      $set: setFields,
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[EndoscopyReports] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:id/approve — Approve all pending edits ─────────────────────────────

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, approved } = req.body;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid endoscopy report ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Store approval status in a dedicated field
    const approvalField = `approvedSections.${sectionId}`;
    await sda.update('endoscopy_reports', { _id: objectId }, {
      $set: {
        [approvalField]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[EndoscopyReports] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
