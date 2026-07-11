/**
 * Physical Therapy Notes Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/physical_therapy_notes/:id/edit    — Edit a single field
 * PUT /api/edit/physical_therapy_notes/:id/approve — Approve all pending edits
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');
let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);
function buildContext(req, operation = 'read') { return { serviceId: 'physical-therapy-notes-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  // Simple strings
  'patientMobilityLevel', 'balanceAssessmentScore', 'gaitPattern', 'edemaGrading', 'transferAbility',
  'postureAnalysis', 'cardiovascularResponse', 'patientCompliance', 'fallRiskAssessment', 'coordinationTesting',
  // Narrative string
  'dischargeReadiness',
  // Numbers
  'painLevelNumericRating', 'functionalIndependenceMeasure', 'sixMinuteWalkTest', 'timedUpAndGoTest',
  // Arrays of strings
  'rangeOfMotionMeasurements', 'muscleStrengthGrading', 'assistiveDeviceUsed', 'neurologicalDeficits',
  'treatmentInterventions', 'rehabilitationGoals',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const updateOp = {
      $set: { [fieldPath]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id },
      $addToSet: { 'doctorEdits.editedFields': field },
    };
    await sda.update('physical_therapy_notes', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[PhysicalTherapyNotes] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('physical_therapy_notes', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[PhysicalTherapyNotes] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
