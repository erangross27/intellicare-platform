/**
 * Medication Optimization Edit Route
 * PUT /api/edit/medication_optimization/:id/edit    — Edit a single field (supports dot-path leaves)
 * PUT /api/edit/medication_optimization/:id/approve — Approve a section's pending edits
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');
const sda = require('../../services/secureDataAccess');
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);
function buildContext(req, operation = 'read') {
  return { serviceId: 'medication-optimization-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] };
}
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }
const ALLOWED_FIELDS = [
  'currentMedications', 'medicationAllergies',
  'creatinineClearance', 'estimatedGFR', 'hepaticFunction',
  'drugInteractions', 'therapeuticDuplicates', 'cyp450Interactions', 'contraindications', 'beersListMedications',
  'targetTherapeuticLevels', 'currentTherapeuticLevels',
  'dosageOptimization', 'deprescribingOpportunities', 'indicationAppropriatenessReview', 'medicationErrors',
  'adherenceAssessment', 'medicationCostAnalysis', 'pillBurdenAssessment', 'formularyStatus',
  'pharmacogeneticTesting', 'adverseEventMonitoring', 'medicationTimingOptimization',
];
router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    }
    await sda.update('medication_optimization', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[MedicationOptimization] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const context = buildContext(req, 'write');
    await sda.update('medication_optimization', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[MedicationOptimization] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
module.exports = router;
