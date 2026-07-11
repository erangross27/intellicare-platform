/**
 * Colorectal Surgery Assessment Edit Route
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

function buildContext(req, operation = 'read') { return { serviceId: 'colorectal-surgery-assessment-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  'date', 'provider', 'facility', 'type', 'status',
  'findings', 'assessment', 'plan', 'notes',
  'recommendations', 'results',
  'colonoscopy.preparation', 'colonoscopy.completeness', 'colonoscopy.polyps', 'colonoscopy.lesions',
  'anorectalManometry.restingPressure', 'anorectalManometry.squeezePressure', 'anorectalManometry.sensoryThreshold', 'anorectalManometry.compliance',
  'defecography.pelvicFloorDescent', 'defecography.rectocele', 'defecography.intussusception', 'defecography.evacuation',
  'stomaAssessment.type', 'stomaAssessment.site', 'stomaAssessment.viability', 'stomaAssessment.complications',
  'oncologicMarkers.cea', 'oncologicMarkers.ca199', 'oncologicMarkers.microsatelliteStatus', 'oncologicMarkers.kras',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const isAllowed = ALLOWED_FIELDS.includes(field) || field.startsWith('colonoscopy.') || field.startsWith('anorectalManometry.') || field.startsWith('defecography.') || field.startsWith('results.') || field.startsWith('stomaAssessment.') || field.startsWith('oncologicMarkers.') || field.startsWith('recommendations.');
    if (!isAllowed) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    }
    await sda.update('colorectal_surgery_assessment', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[ColorectalSurgeryAssessment] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('colorectal_surgery_assessment', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[ColorectalSurgeryAssessment] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
