/**
 * CYP450 Panel Results Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/cyp450_panel_results/:id/edit    — Edit a single field
 * PUT /api/edit/cyp450_panel_results/:id/approve — Approve pending edits
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
    serviceId: 'cyp450-panel-results-edit-service',
    userId: req.user?.id,
    operation,
    practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId,
    permissions: [operation === 'read' ? 'read' : 'write'],
  };
}

function toObjectId(str) {
  try { return new mongoose.Types.ObjectId(str); } catch { return null; }
}

const ALLOWED_FIELDS = [
  'cyp2d6Genotype',
  'cyp2d6PhenotypeClassification',
  'cyp2d6ActivityScore',
  'cyp2c19Genotype',
  'cyp2c19PhenotypeClassification',
  'cyp2c9Genotype',
  'cyp2c9PhenotypeClassification',
  'cyp2c8Genotype',
  'cyp3a4Genotype',
  'cyp3a5Genotype',
  'cyp3a5ExpresserStatus',
  'cyp2b6Genotype',
  'cyp1a2InducerStatus',
  'vkorc1Genotype',
  'warfarinSensitivityCategory',
  'calculatedWarfarinDose',
  'clopidogrelResponsePrediction',
  'dpydGenotype',
  'dpydActivityScore',
  'tpmtGenotype',
  'tpmtPhenotypeClassification',
  'nudt15Genotype',
  'slco1b1Genotype',
  'genesDrugInteractionsSummary',
  'copyNumberVariantsDetected',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const rootField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(field) && !ALLOWED_FIELDS.includes(rootField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const setFields = { [`${field}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id };
    if (arrayIndex !== undefined) {
      setFields[`${field}.${arrayIndex}`] = value;
      delete setFields[`${field}`];
    }
    await sda.update('cyp450_panel_results', { _id: objectId }, { $set: setFields, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    return res.json({ success: true, id, editedField: field });
  } catch (err) {
    console.error(`[cyp450_panel_results] PUT /:id/edit error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    await sda.update('cyp450_panel_results', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, id, status: 'approved' });
  } catch (err) {
    console.error(`[cyp450_panel_results] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
