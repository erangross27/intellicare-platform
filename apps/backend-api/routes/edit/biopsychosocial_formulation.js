/**
 * Biopsychosocial Formulation Edit Route
 * PUT /api/edit/biopsychosocial_formulation/:id/edit    — Edit a single field
 * PUT /api/edit/biopsychosocial_formulation/:id/approve — Approve pending edits
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }

router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

function buildContext(req, operation = 'read') { return { serviceId: 'biopsychosocial-formulation-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  'biologicalFactors.genetics', 'biologicalFactors.neurotransmitters', 'biologicalFactors.substanceEffects',
  'biologicalFactors.medicalConditions', 'biologicalFactors.medications',
  'psychologicalFactors.selfEsteem',
  'psychologicalFactors.cognitiveBiases', 'psychologicalFactors.copingMechanisms', 'psychologicalFactors.trauma',
  'socialFactors.occupationalStress', 'socialFactors.financialStressors', 'socialFactors.socialSupport',
  'socialFactors.familyDynamics', 'socialFactors.housingStability',
  'biologicalFactors', 'psychologicalFactors', 'socialFactors',
  'strengths', 'vulnerabilities', 'perpetuatingFactors', 'protectiveFactors',
  'recommendations', 'results', 'status', 'type', 'additionalData',
  'integratedFormulation', 'findings', 'assessment', 'plan', 'notes',
  'date', 'provider', 'facility',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const baseField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(field) && !ALLOWED_FIELDS.includes(baseField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    if (arrayIndex !== undefined) { updateOp.$set = { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }; updateOp.$addToSet = { 'doctorEdits.editedFields': `${field}.${arrayIndex}` }; }
    await sda.update('biopsychosocial_formulation', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[BiopsychosocialFormulation] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    await sda.update('biopsychosocial_formulation', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[BiopsychosocialFormulation] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
