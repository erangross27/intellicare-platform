const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');
let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);
function buildContext(req, operation = 'read') { return { serviceId: 'functional-assessments-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }
const ALLOWED_FIELDS = ['adlScore', 'iadlScore', 'barthelsIndex', 'miniMentalStateScore', 'glasgowComaScale', 'montrealCognitiveAssessment', 'karnofskyPerformanceScale', 'ecogPerformanceStatus', 'nyhaClassification', 'sixMinuteWalkDistance', 'timedUpAndGoTest', 'bergBalanceScale', 'functionalIndependenceMeasure', 'rankinScale', 'ashworthScale', 'manualMuscleTestGrade', 'rangeOfMotionMeasurements', 'gripStrengthPounds', 'pusherSyndromeScale', 'motorAssessmentScale', 'cogatScore', 'functionalReachTest', 'dynamicGaitIndex', 'westernOntarioMcMasterScore', 'lowExtremetyFunctionalScale'];
/* Allowed subfields for array-of-object roots: rangeOfMotionMeasurements[].{joint,degrees} */
const ALLOWED_ARRAY_SUBFIELDS = { rangeOfMotionMeasurements: ['joint', 'degrees'] };
router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const parts = field.split('.');
    const parentField = parts[0];
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    /* Validate array dot-path shape: root.<index> or root.<index>.<subField> */
    if (parts.length > 1) {
      const allowedSubs = ALLOWED_ARRAY_SUBFIELDS[parentField];
      if (!allowedSubs) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
      if (!/^\d+$/.test(parts[1])) return res.status(400).json({ success: false, error: 'Invalid array index in field path' });
      if (parts.length > 3) return res.status(400).json({ success: false, error: 'Invalid field path' });
      if (parts.length === 3 && !allowedSubs.includes(parts[2])) return res.status(400).json({ success: false, error: `Subfield "${parts[2]}" is not editable` });
    }
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    }
    await sda.update('functional_assessments', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[FunctionalAssessments] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('functional_assessments', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[FunctionalAssessments] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});
module.exports = router;
