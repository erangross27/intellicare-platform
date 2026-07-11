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
    serviceId: 'polypharmacy-reviews-edit-service',
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
  'patientMedications', 'medicationCount', 'pillBurdenAssessment', 'medicationAdherenceScore',
  'potentialDrugInteractions', 'inappropriateMedications', 'duplicateTherapies', 'therapeuticDuplicates',
  'fallRiskMedications', 'qtProlongingAgents', 'anticholinergicBurdenScore', 'adverseDrugReactions',
  'renalFunctionAdjustments', 'hepaticAdjustments',
  'drugAllergyContraindications', 'medicationReconciliationDiscrepancies', 'prescribingCascadeIdentified', 'costOptimizationOpportunities',
  'deprescribingCandidates', 'monitoringParameters',
];
const ALLOWED_SUBFIELDS = {
  potentialDrugInteractions: ['drugs', 'severity', 'interaction', 'mechanism', 'management', 'recommendation', 'medication', 'description'],
  inappropriateMedications: ['medication', 'criteria', 'reason'],
  renalFunctionAdjustments: ['medication', 'eGFR', 'recommendation'],
  hepaticAdjustments: ['medication', 'childPugh', 'recommendation'],
  monitoringParameters: ['medication', 'parameter', 'frequency'],
  deprescribingCandidates: ['drug', 'medication', 'recommendation', 'rationale', 'reason'],
};

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex, subField } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const rootField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(field) && !ALLOWED_FIELDS.includes(rootField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    if (subField && !(ALLOWED_SUBFIELDS[rootField] || []).includes(subField)) return res.status(400).json({ success: false, error: `Subfield "${subField}" is not editable for "${rootField}"` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const setFields = { [`${field}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id };
    if (arrayIndex !== undefined && arrayIndex !== null && subField) { setFields[`${field}.${arrayIndex}.${subField}`] = value; delete setFields[`${field}`]; }
    else if (arrayIndex !== undefined && arrayIndex !== null) { setFields[`${field}.${arrayIndex}`] = value; delete setFields[`${field}`]; }
    await sda.update('polypharmacy_reviews', { _id: objectId }, { $set: setFields, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    return res.json({ success: true, id, editedField: field });
  } catch (err) {
    console.error(`[polypharmacy_reviews] PUT /:id/edit error:`, err.message);
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
    await sda.update('polypharmacy_reviews', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, id, status: 'approved' });
  } catch (err) {
    console.error(`[polypharmacy_reviews] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;
