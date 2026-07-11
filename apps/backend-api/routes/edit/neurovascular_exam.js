const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');
let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);
function buildContext(req, op = 'read') { return { serviceId: 'neurovascular-exam-edit-service', userId: req.user?.id, operation: op, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [op === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }
const ALLOWED_FIELDS = ['date', 'provider', 'facility', 'status', 'type', 'sensoryExam', 'motorExam', 'pulses', 'capillaryRefill', 'findings', 'assessment', 'plan', 'notes', 'recommendations', 'results'];
router.put('/:id/edit', async (req, res) => {
  try {
    const { field, value, arrayIndex } = req.body;
    if (!field) return res.status(400).json({ error: 'field is required' });
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ error: `Field "${parentField}" is not editable` });
    const sda = getSecureDataAccess();
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    let updatePath = field;
    if (arrayIndex !== undefined && arrayIndex !== null) updatePath = `${field}.${arrayIndex}`;
    const result = await sda.update('neurovascular_exam', { _id: oid }, { $set: { [updatePath]: value, [`doctorEdits.${field}`]: { value, editedAt: new Date(), editedBy: req.user?.id || 'doctor' } } }, buildContext(req, 'write'));
    res.json({ success: result.modifiedCount > 0, field, value });
  } catch (err) { console.error('Edit error:', err); res.status(500).json({ error: 'Failed to save edit' }); }
});
router.put('/:id/approve', async (req, res) => {
  try {
    const { sectionId } = req.body;
    const sda = getSecureDataAccess();
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ error: 'Invalid ID' });
    const result = await sda.update('neurovascular_exam', { _id: oid }, { $set: { [`doctorEdits.approvedSections.${sectionId}`]: { approved: true, approvedAt: new Date(), approvedBy: req.user?.id || 'doctor' } } }, buildContext(req, 'write'));
    res.json({ success: result.modifiedCount > 0 });
  } catch (err) { console.error('Approve error:', err); res.status(500).json({ error: 'Failed to approve' }); }
});
module.exports = router;
