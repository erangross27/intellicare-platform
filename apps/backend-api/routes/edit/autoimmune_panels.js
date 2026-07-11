/**
 * Autoimmune Panels Edit Route
 * PUT /api/edit/autoimmune_panels/:id/edit
 * PUT /api/edit/autoimmune_panels/:id/approve
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

let secureDataAccess;
function getSecureDataAccess() { if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess'); return secureDataAccess; }
router.use(practiceContext); router.use(practiceModels); router.use(practiceAuth);

const ALLOWED_FIELDS = ['panelType', 'indication', 'ana', 'enaPanel', 'dsDna', 'rheumatoidFactor', 'antiCcp', 'complement', 'anca', 'antiphospholipid', 'interpretation', 'clinicalCorrelation', 'orderingProvider', 'lab', 'notes'];

function buildContext(req, op = 'read') { return { serviceId: 'autoimmune-panels-edit-service', userId: req.user?.id, operation: op, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [op === 'read' ? 'read' : 'write'] }; }
function toObjectId(s) { try { return new mongoose.Types.ObjectId(s); } catch { return null; } }

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!ALLOWED_FIELDS.includes(field.split('.')[0])) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const oid = toObjectId(id); if (!oid) return res.status(400).json({ success: false, error: 'Invalid record ID' });
    await getSecureDataAccess().update('autoimmune_panels', { _id: oid }, { $set: { [field]: value, updatedAt: new Date(), updatedBy: req.user?.id } }, buildContext(req, 'write'));
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[AutoimmunePanels] edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const { sectionId, approved } = req.body;
    const oid = toObjectId(id); if (!oid) return res.status(400).json({ success: false, error: 'Invalid record ID' });
    await getSecureDataAccess().update('autoimmune_panels', { _id: oid }, { $set: { [`approvedSections.${sectionId}`]: approved, approvalTimestamp: new Date(), approvedBy: req.user?.id } }, buildContext(req, 'write'));
    return res.json({ success: true, recordId: id, sectionId, approved });
  } catch (err) { console.error('[AutoimmunePanels] approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
