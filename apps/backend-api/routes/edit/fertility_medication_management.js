/**
 * Fertility Medication Management Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/fertility_medication_management/:id/edit    — Edit a single field on a fertility medication management record
 * PUT /api/edit/fertility_medication_management/:id/approve — Approve all pending edits
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

// Middleware: context -> models -> auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'fertility-medication-management-edit-service',
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

// Allowed editable fields for fertility_medication_management
const ALLOWED_FIELDS = [
  'date',
  'medicationProtocolType', 'gonadotropinType', 'gonadotropinDoseIU',
  'gnrhAgonistAgent', 'gnrhAntagonistAgent', 'triggerMedicationType',
  'triggerDoseIU', 'lutealPhaseSupportRegimen', 'progesteroneDoseMg',
  'estradiolLevelPgMl', 'serumLhLevelMiuMl', 'serumProgesteroneLevelNgMl',
  'antiMullerianHormoneNgMl', 'antralFollicleCount', 'stimulationDayNumber',
  'totalStimulationDays', 'folliclesGreaterThan14mm', 'leadFollicleSizeMm',
  'endometrialThicknessMm', 'ohssRiskCategory', 'cabergolineOhssProphylaxis',
  'letrozoleDoseMg', 'clomipheneCitrateDoseMg', 'adjunctMedications',
  'medicationAdverseEvents',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[FertilityMedicationManagement] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[FertilityMedicationManagement] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Support nested field paths — validate parent field
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid fertility medication management record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[FertilityMedicationManagement] context:', JSON.stringify(context));

    // Support arrayIndex for array fields
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('fertility_medication_management', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[FertilityMedicationManagement] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[FertilityMedicationManagement] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Fertility medication management record not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[FertilityMedicationManagement] PUT /:id/edit error:', err.message);
    console.error('[FertilityMedicationManagement] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid fertility medication management record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('fertility_medication_management', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[FertilityMedicationManagement] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
