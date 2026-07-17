/**
 * Airway Management Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/airway_management_records/:id/edit    — Edit a single field
 * PUT /api/edit/airway_management_records/:id/approve — Approve a section
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
  'airwayAssessmentScore',
  'thyromentalDistance',
  'mouthOpeningDistance',
  'neckCircumference',
  'neckMobilityRestriction',
  'rapidSequenceIntubation',
  'cricoidPressureApplied',
  'difficultAirwayEncountered',
  'intubationMethod',
  'laryngoscopeBladeType',
  'endotrachealTubeSize',
  'endotrachealTubeType',
  'tubeDepthAtTeeth',
  'cormackLehaneGrade',
  'intubationAttempts',
  'preoxygenationMethod',
  'inductionAgents',
  'neuromusculatBlocker',
  'alternativeAirwayDevices',
  'tubePlacementConfirmation',
  'endTidalCO2Value',
  'cuffPressure',
  'oxygenSaturationPostIntubation',
  'extubationTime',
  'complicationsDuringIntubation',
];
const ARRAY_FIELDS = new Set([
  'inductionAgents',
  'alternativeAirwayDevices',
  'tubePlacementConfirmation',
  'complicationsDuringIntubation',
]);

function isAllowedFieldPath(field) {
  const parts = String(field).split('.');
  if (!ALLOWED_FIELDS.includes(parts[0])) return false;
  if (parts.length === 1) return true;
  return parts.length === 2 && ARRAY_FIELDS.has(parts[0]) && /^\d+$/.test(parts[1]);
}

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'airway-management-edit-service',
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

    if (!isAllowedFieldPath(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('airway_management_records', { _id: objectId }, {
      $set: {
        [field]: value,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[AirwayManagementRecords] PUT /:id/edit error:', err.message);
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

    await sda.update('airway_management_records', { _id: objectId }, {
      $set: {
        [`approvedSections.${sectionId}`]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[AirwayManagementRecords] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
