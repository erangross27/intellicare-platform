/**
 * Autopsy Reports Edit Route
 * PUT /api/edit/autopsy_reports/:id/edit
 * PUT /api/edit/autopsy_reports/:id/approve
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);

const ALLOWED_FIELDS = [
  'decedentName', 'autopsyType', 'indication', 'externalExamination', 'internalExamination',
  'cardiovascular', 'respiratory', 'gastrointestinal', 'neurologicalBrain', 'toxicology',
  'microscopic', 'causeOfDeath', 'mannerOfDeath', 'contributingFactors',
  'pathologist', 'facility', 'notes', 'dateOfDeath', 'autopsyDate',
];

function buildContext(req, op = 'read') { return { serviceId: 'autopsy-reports-edit-service', userId: req.user?.id, operation: op, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [op === 'read' ? 'read' : 'write'] }; }
function toObjectId(s) { try { return new mongoose.Types.ObjectId(s); } catch { return null; } }

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!ALLOWED_FIELDS.includes(field.split('.')[0])) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const oid = toObjectId(id); if (!oid) return res.status(400).json({ success: false, error: 'Invalid record ID' });
    let updatePath = field; if (arrayIndex !== undefined && arrayIndex !== null) updatePath = `${field}.${arrayIndex}`;
    await getSecureDataAccess().update('autopsy_reports', { _id: oid }, { $set: { [updatePath]: value, updatedAt: new Date(), updatedBy: req.user?.id } }, buildContext(req, 'write'));
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[AutopsyReports] edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const { sectionId, approved } = req.body;
    const oid = toObjectId(id); if (!oid) return res.status(400).json({ success: false, error: 'Invalid record ID' });
    await getSecureDataAccess().update('autopsy_reports', { _id: oid }, { $set: { [`approvedSections.${sectionId}`]: approved, approvalTimestamp: new Date(), approvedBy: req.user?.id } }, buildContext(req, 'write'));
    return res.json({ success: true, recordId: id, sectionId, approved });
  } catch (err) { console.error('[AutopsyReports] approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
