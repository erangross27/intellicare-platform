/**
 * DiabetesEducator Edit Route
 * ServiceId: diabetes-educator-edit-service
 * Collection: diabetes_educator
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

function buildContext(req, operation = 'read') { return { serviceId: 'diabetes-educator-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  'date', 'provider', 'facility', 'sessionType', 'diabetesType', 'diagnosisDate',
  'currentA1c', 'targetA1c', 'currentMedications',
  'insulinRegimen.basal.type', 'insulinRegimen.basal.dose', 'insulinRegimen.basal.timing',
  'insulinRegimen.bolus.type', 'insulinRegimen.bolus.dosing',
  'bloodGlucoseTargets.fasting', 'bloodGlucoseTargets.preMeal', 'bloodGlucoseTargets.postMeal',
  'selfMonitoringFrequency', 'hypoglycemiaHistory', 'hypoglycemiaTreatment',
  'carbohydrateCounting', 'mealPlanType', 'nutritionGoals',
  'physicalActivityPlan', 'footExamPerformed', 'footCareKnowledge',
  'complicationsScreening.retinopathy', 'complicationsScreening.nephropathy', 'complicationsScreening.neuropathy',
  'psychosocialBarriers', 'technologyUsed', 'sickDayManagement', 'nextEducationTopic'
];

/* Dynamic-key object roots: subfield keys vary per record (e.g. fasting/preMeal/
   postMeal OR dayTarget/nightTarget/TIR; retinopathy/.../cardiovascular). Allow
   any single-level scalar subfield under these roots (path-traversal guarded). */
const DYNAMIC_OBJECT_ROOTS = ['bloodGlucoseTargets', 'complicationsScreening'];

function isAllowedField(field) {
  if (typeof field !== 'string' || !field) return false;
  if (ALLOWED_FIELDS.includes(field)) return true;
  const parts = field.split('.');
  if (parts.length === 2 && DYNAMIC_OBJECT_ROOTS.includes(parts[0])) {
    // single dynamic subfield key: alphanumeric only (no __proto__/$/dots)
    return /^[A-Za-z][A-Za-z0-9]*$/.test(parts[1]);
  }
  return false;
}

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!isAllowedField(field)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    }
    await sda.update('diabetes_educator', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[DiabetesEducator] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('diabetes_educator', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[DiabetesEducator] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
