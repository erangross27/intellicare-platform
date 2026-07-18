/**
 * Cancer Staging Edit Route
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

function buildContext(req, operation = 'read') { return { serviceId: 'cancer-staging-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  'tnmStaging.overallStage', 'tnmStaging.t', 'tnmStaging.n', 'tnmStaging.m',
  'issStaging', 'rissStaging', 'durieSalmon', 'annArbor', 'figo',
  'otherStaging', 'results', 'recommendations',
  'findings', 'assessment', 'plan', 'notes',
  'date', 'provider', 'facility', 'status', 'type', 'additionalData',
];
// Nested object leaves are edited via dotted paths; allow any depth under these object roots.
const ALLOWED_PREFIXES = ['tnmStaging.', 'otherStaging.', 'results.', 'additionalData.'];
function isFieldAllowed(field) { if (ALLOWED_FIELDS.includes(field)) return true; return ALLOWED_PREFIXES.some(p => field.startsWith(p)); }

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!isFieldAllowed(field)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': field } };
    await sda.update('cancer_staging', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[CancerStaging] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    await sda.update('cancer_staging', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[CancerStaging] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
