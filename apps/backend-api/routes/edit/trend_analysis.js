/**
 * Trend Analysis Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 */

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
    serviceId: 'trend-analysis-edit-service',
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
  'date',
  'provider',
  'facility',
  'laboratoryTrends',
  'vitalSignTrends',
  'clinicalTrends',
  'renalTrends',
  'findings',
  'assessment',
  'plan',
  'results',
  'recommendations',
  'notes',
  'status',
];

// Per object-array field, the subfields allowed in arrayIndex+subField writes (preserves object shape).
const ALLOWED_SUBFIELDS = {
  laboratoryTrends: ['test', 'currentValue', 'previousValue', 'trend', 'dateRange'],
  recommendations: ['recommendation', 'date'],
};

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex, subField } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    const rootField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(field) && !ALLOWED_FIELDS.includes(rootField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id);
    if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    let targetPath = field;
    if (arrayIndex !== undefined && arrayIndex !== null && subField) {
      // Object-array per-subfield write (preserves the {test, currentValue, ...} item shape).
      const allowedSubs = ALLOWED_SUBFIELDS[rootField];
      if (!allowedSubs || !allowedSubs.includes(subField)) return res.status(400).json({ success: false, error: `Subfield "${subField}" is not editable` });
      targetPath = `${rootField}.${arrayIndex}.${subField}`;
    } else if (arrayIndex !== undefined && arrayIndex !== null) {
      targetPath = `${rootField}.${arrayIndex}`;
    }

    const setFields = { [targetPath]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id };
    await sda.update('trend_analysis', { _id: objectId }, { $set: setFields, $addToSet: { 'doctorEdits.editedFields': rootField } }, context);
    return res.json({ success: true, id, editedField: targetPath });
  } catch (err) {
    console.error(`[trend_analysis] PUT /:id/edit error:`, err.message);
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
    await sda.update('trend_analysis', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, id, status: 'approved' });
  } catch (err) {
    console.error(`[trend_analysis] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
