/**
 * Cardiac Device Interrogations Edit Route
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

function buildContext(req, operation = 'read') { return { serviceId: 'cardiac-device-interrogations-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  // STRING (short)
  'deviceType', 'manufacturer', 'model', 'serialNumber', 'implantDate', 'interrogationDate',
  // STRING (narrative)
  'interrogationReason', 'clinicalAssessment', 'followUpPlan', 'recommendations',
  // OBJECT (dotted sub-paths supported via prefix match below)
  'batteryStatus', 'pacingParameters', 'pacingPercentages', 'sensingThresholds',
  'icdTherapy', 'atrialFibrillationBurden', 'remoteMonitoring',
  // ARRAY
  'leads', 'arrhythmiaEpisodes', 'alerts', 'programmingChanges', 'deviceAlerts',
];
// A field is allowed if it equals an allowed field, OR its top-level segment (field.split('.')[0])
// is an allowed object/array root (supports dotted object sub-paths and array index paths).
const isDotPathAllowed = (field) => ALLOWED_FIELDS.some(af => field === af || field.startsWith(af + '.')) || ALLOWED_FIELDS.includes(field.split('.')[0]);

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!isDotPathAllowed(field)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    await sda.update('cardiac_device_interrogations', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[CardiacDevice] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    await sda.update('cardiac_device_interrogations', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[CardiacDevice] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
