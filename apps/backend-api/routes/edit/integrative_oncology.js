const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');
let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);
function buildContext(req, operation = 'read') { return { serviceId: 'integrative-oncology-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }
const ALLOWED_FIELDS = ['provider', 'facility', 'date', 'type', 'complementaryTherapies', 'nutritionalSupport', 'nutritionalSupport.dietitian', 'nutritionalSupport.dietType', 'nutritionalSupport.caloricNeeds', 'nutritionalSupport.proteinNeeds', 'nutritionalSupport.hydrationGoal', 'nutritionalSupport.keyFoods', 'nutritionalSupport.foodsToAvoid', 'exerciseProgram', 'exerciseProgram.exercisePhysiologist', 'exerciseProgram.aerobic', 'exerciseProgram.resistance', 'exerciseProgram.flexibility', 'exerciseProgram.balance', 'exerciseProgram.gripStrengthening', 'mindBodyPractices', 'acupuncture', 'supplements', 'notes', 'findings', 'assessment', 'plan', 'recommendations', 'results', 'status', 'additionalData'];
router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField) && !ALLOWED_FIELDS.includes(field)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    }
    await sda.update('integrative_oncology', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[IntegrativeOncology] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('integrative_oncology', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[IntegrativeOncology] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
module.exports = router;
