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
    serviceId: 'plastic-surgery-assessment-edit-service',
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
  'reconstructionOptionsDiscussed',
  'patientPreference', 'patientPreference.chosenOption', 'patientPreference.reasonForChoice',
  'patientConcerns',
  'donorSiteAssessment',
  'donorSiteAssessment.abdomen', 'donorSiteAssessment.abdomen.tissueVolume', 'donorSiteAssessment.abdomen.skinQuality', 'donorSiteAssessment.abdomen.previousPregnancies', 'donorSiteAssessment.abdomen.striae', 'donorSiteAssessment.abdomen.previousAbdominalSurgery', 'donorSiteAssessment.abdomen.perforatorQuality',
  'donorSiteAssessment.innerThighs', 'donorSiteAssessment.innerThighs.tissueVolume', 'donorSiteAssessment.innerThighs.skinQuality', 'donorSiteAssessment.innerThighs.suitabilityForPAPFlap',
  'donorSiteAssessment.glutealRegion', 'donorSiteAssessment.glutealRegion.tissueVolume', 'donorSiteAssessment.glutealRegion.previousSurgery', 'donorSiteAssessment.glutealRegion.suitabilityForGAPFlap',
  'measurements', 'measurements.sternalNotchToNipple', 'measurements.sternalNotchToNipple.right', 'measurements.sternalNotchToNipple.left', 'measurements.nippleToInframammaryFold', 'measurements.nippleToInframammaryFold.right', 'measurements.nippleToInframammaryFold.left', 'measurements.chestWidth', 'measurements.desiredCupSize',
  'preoperativePhotography', 'preoperativePhotography.views', 'preoperativePhotography.measurements', 'preoperativePhotography.asymmetries',
  'skinAnalysis', 'skinAnalysis.fitzpatrickType', 'skinAnalysis.laxity', 'skinAnalysis.thickness', 'skinAnalysis.scarring',
  'flapAssessment', 'flapAssessment.donorSite', 'flapAssessment.recipientSite', 'flapAssessment.vascularStatus', 'flapAssessment.dimensions',
  'implantData', 'implantData.type', 'implantData.size', 'implantData.manufacturer', 'implantData.serialNumber',
  'vascularExamination', 'vascularExamination.allenTest', 'vascularExamination.venousInsufficiency', 'vascularExamination.dopplerSignals',
  'aestheticGoals', 'aestheticGoals.patientExpectations', 'aestheticGoals.achievableOutcome', 'aestheticGoals.limitations',
  'results',
  'date', 'type', 'provider', 'facility',
  'assessment', 'plan', 'findings', 'notes', 'recommendations', 'status',
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
    if (arrayIndex !== undefined) { setFields[`${field}.${arrayIndex}`] = value; delete setFields[`${field}`]; }
    await sda.update('plastic_surgery_assessment', { _id: objectId }, { $set: setFields, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    return res.json({ success: true, id, editedField: field });
  } catch (err) {
    console.error(`[plastic_surgery_assessment] PUT /:id/edit error:`, err.message);
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
    await sda.update('plastic_surgery_assessment', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, id, status: 'approved' });
  } catch (err) {
    console.error(`[plastic_surgery_assessment] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});
module.exports = router;
