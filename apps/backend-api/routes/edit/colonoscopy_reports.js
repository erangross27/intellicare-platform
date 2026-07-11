/**
 * Colonoscopy Reports Edit Route
 * Collection: colonoscopy_reports
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

function buildContext(req, operation = 'read') { return { serviceId: 'colonoscopy-reports-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  'patientPreparation', 'bostonBowelPrepScale', 'scopeInsertionDepth',
  'cecalIntubationTime', 'withdrawalTime', 'cecalLandmarks',
  'polypsIdentified', 'inflammatoryChanges', 'histopathologyResults', 'adenomaDetectionRate',
  'polypectomyTechnique', 'parisClassification', 'chromoendoscopyUsed',
  'biopsiesTaken',
  'complicationsDuringProcedure', 'mayoScore', 'cdaiScore', 'diverticulosisPresent', 'vascularLesions', 'tattoosPlaced',
  'nextSurveillanceInterval', 'sedationUsed',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex, subField } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    if (arrayIndex !== undefined && arrayIndex !== null && subField) {
      await sda.update('colonoscopy_reports', { _id: objectId }, { $set: { [`${field}.${arrayIndex}.${subField}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    } else if (arrayIndex !== undefined && arrayIndex !== null) {
      await sda.update('colonoscopy_reports', { _id: objectId }, { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    } else {
      await sda.update('colonoscopy_reports', { _id: objectId }, { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    }
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[ColonoscopyReports] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('colonoscopy_reports', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[ColonoscopyReports] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
