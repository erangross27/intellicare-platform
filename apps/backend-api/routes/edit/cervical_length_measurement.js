/**
 * Cervical Length Measurement Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/cervical_length_measurement/:id/edit    — Edit a single field
 * PUT /api/edit/cervical_length_measurement/:id/approve — Approve all pending edits
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
    serviceId: 'cervical-length-measurement-edit-service',
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

// Allowed editable fields for cervical_length_measurement (the 21 extractable fields)
const ALLOWED_FIELDS = [
  'gestationalAge', 'cervicalLengthCentimeters', 'cervicalLengthPercentile', 'measurementTechnique',
  'internalOsAppearance', 'externalOsAppearance', 'cervicalFunneling', 'funnelingLength',
  'funnelingWidth', 'cervicalEchogenicity', 'placentalLocation', 'cervicalCerclagePresent',
  'cerclageType', 'amniotiFluidVolume', 'bladderEmptyingStatus', 'cervicalLengthRisk',
  'repeatMeasurementRecommended', 'measurementConfidence', 'cervicalChange',
  'multipleMeasurementsObtained', 'shortestMeasurement',
];

// ─── PUT /:id/edit — Edit a single field ──────────────────────────────────────

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    console.log('[CervicalLengthMeasurement] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value);
    console.log('[CervicalLengthMeasurement] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid cervical length measurement ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[CervicalLengthMeasurement] context:', JSON.stringify(context));

    const setFields = {
      [field]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('cervical_length_measurement', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[CervicalLengthMeasurement] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[CervicalLengthMeasurement] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Cervical length measurement not found in database' });
    }

    return res.json({ success: true, cervicalLengthMeasurementId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[CervicalLengthMeasurement] PUT /:id/edit error:', err.message);
    console.error('[CervicalLengthMeasurement] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:id/approve — Approve all pending edits ─────────────────────────────

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid cervical length measurement ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('cervical_length_measurement', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, cervicalLengthMeasurementId: id, status: 'approved' });
  } catch (err) {
    console.error('[CervicalLengthMeasurement] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
