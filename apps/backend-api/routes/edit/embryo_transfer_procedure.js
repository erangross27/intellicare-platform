/**
 * Embryo Transfer Procedure Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/embryo_transfer_procedure/:id/edit    — Edit a single field on an embryo transfer procedure record
 * PUT /api/edit/embryo_transfer_procedure/:id/approve — Approve all pending edits
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
    serviceId: 'embryo-transfer-procedure-edit-service',
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

// Allowed editable fields for embryo_transfer_procedure
const ALLOWED_FIELDS = [
  'transferDate', 'embryologistName', 'numberOfEmbryosTransferred',
  'embryoDevelopmentStage', 'gardnerGradingScore', 'embryoQualityGrade',
  'innerCellMassGrade', 'trophectodermGrade', 'catheterType',
  'transferTechniqueType', 'ultrasoundGuidanceUsed', 'endometrialThicknessMm',
  'endometrialPattern', 'embryoPlacementDistanceFromFundusCm',
  'transferDifficultyScore', 'cervicalMucusRemoved', 'trialTransferPerformed',
  'catheterLoadingTechnique', 'retainedEmbryosOnCatheter', 'bloodOnCatheterTip',
  'mucusOnCatheterTip', 'preimplantationGeneticTestingPerformed', 'pgtResult',
  'assistedHatchingPerformed', 'embryoCryopreservationMethod',
  'progesteroneSupportProtocol', 'estrogenLevelOnTransferDayPgMl',
  'progesteroneLevelOnTransferDayNgMl', 'betaHcgTestDate', 'procedureComplications',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[EmbryoTransferProcedure] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[EmbryoTransferProcedure] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

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
      return res.status(400).json({ success: false, error: 'Invalid embryo transfer procedure record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[EmbryoTransferProcedure] context:', JSON.stringify(context));

    // Support arrayIndex for array fields
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('embryo_transfer_procedure', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[EmbryoTransferProcedure] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[EmbryoTransferProcedure] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Embryo transfer procedure record not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[EmbryoTransferProcedure] PUT /:id/edit error:', err.message);
    console.error('[EmbryoTransferProcedure] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid embryo transfer procedure record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('embryo_transfer_procedure', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[EmbryoTransferProcedure] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
