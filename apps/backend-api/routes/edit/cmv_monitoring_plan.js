/**
 * CMV Monitoring Plan Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/cmv_monitoring_plan/:id/edit    — Edit a single field
 * PUT /api/edit/cmv_monitoring_plan/:id/approve — Approve all pending edits
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
    serviceId: 'cmv-monitoring-plan-edit-service',
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

// Allowed editable fields for cmv_monitoring_plan
const ALLOWED_FIELDS = [
  'date', 'provider', 'facility', 'patientImmuneStatus',
  'transplantType', 'transplantDate', 'donorCmvSerostatus', 'recipientCmvSerostatus', 'riskStratification',
  'monitoringFrequency', 'monitoringMethod', 'viralLoadThreshold', 'nextMonitoringDate',
  'currentViralLoad', 'viralLoadTrend',
  'cd4Count', 'previousCmvEpisodes', 'immunosuppressionLevel',
  'cmvDiseaseSymptoms',
  'prophylaxisRegimen', 'prophylaxisDuration', 'preemptiveTherapyIndication',
  'drugResistanceTesting', 'ganciclovirResistance', 'alternativeTherapyRequired',
];

// ─── PUT /:id/edit — Edit a single field ──────────────────────────────────────

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid CMV monitoring plan ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Array item edit
    if (arrayIndex !== undefined && arrayIndex !== null) {
      const arrayField = `${field}.${arrayIndex}`;
      await sda.update('cmv_monitoring_plan', { _id: objectId }, {
        $set: {
          [arrayField]: value,
          updatedAt: new Date(),
          updatedBy: req.user?.id,
        },
      }, context);
      return res.json({ success: true, recordId: id, editedField: field, arrayIndex });
    }

    const setFields = {
      [field]: value,
      updatedAt: new Date(),
      updatedBy: req.user?.id,
    };

    await sda.update('cmv_monitoring_plan', { _id: objectId }, {
      $set: setFields,
    }, context);

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[CmvMonitoringPlan] PUT /:id/edit error:', err.message);
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
      return res.status(400).json({ success: false, error: 'Invalid CMV monitoring plan ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const approvalField = `approvedSections.${sectionId}`;
    await sda.update('cmv_monitoring_plan', { _id: objectId }, {
      $set: {
        [approvalField]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[CmvMonitoringPlan] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
