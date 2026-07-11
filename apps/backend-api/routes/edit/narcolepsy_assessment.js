/**
 * Edit Route
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
    serviceId: 'narcolepsy-assessment-edit-service',
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
  'epworthSleepinessScore',
  'cataplexyPresent',
  'cataplexyFrequency',
  'cataplexyTriggers',
  'sleepParalysisEpisodes',
  'hypnagogicHallucinations',
  'hypnopompicHallucinations',
  'automaticBehaviors',
  'sleepLatencyMinutes',
  'sleepOnsetREMPeriods',
  'polySomnographyDate',
  'totalSleepTimeHours',
  'remLatencyMinutes',
  'hlaTyping',
  'hypocretinLevel',
  'narcolepsyType',
  'symptomOnsetAge',
  'excessiveDaytimeSleepiness',
  'inadvertentNaps',
  'refreshingNaps',
  'stimulantMedications',
  'sodiumOxybateDose',
  'functionalImpairment',
  'comorbidSleepDisorders',
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
    if (arrayIndex !== undefined) {
      setFields[`${field}.${arrayIndex}`] = value;
      delete setFields[`${field}`];
    }
    await sda.update('narcolepsy_assessment', { _id: objectId }, { $set: setFields, $addToSet: { 'doctorEdits.editedFields': field } }, context);
    return res.json({ success: true, id, editedField: field });
  } catch (err) {
    console.error(`[NarcolepsyAssessment] PUT /:id/edit error:`, err.message);
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
    await sda.update('narcolepsy_assessment', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, id, status: 'approved' });
  } catch (err) {
    console.error(`[NarcolepsyAssessment] PUT /:id/approve error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
