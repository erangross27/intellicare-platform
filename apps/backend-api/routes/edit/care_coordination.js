/**
 * Care Coordination Edit Route
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

function buildContext(req, operation = 'read') { return { serviceId: 'care-coordination-edit-service', userId: req.user?.id, operation, practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId, permissions: [operation === 'read' ? 'read' : 'write'] }; }
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  // STRING
  'referralSource', 'referralDestination', 'referralReason', 'transitionType', 'careCoordinator',
  'functionalStatus', 'cognitiveStatus', 'mobilityLevel', 'fallRiskAssessment',
  'insuranceAuthorization', 'languageBarriers', 'culturalConsiderations',
  // NUMBER
  'readmissionRiskScore',
  // DATE
  'referralDate',
  // ARRAY
  'primaryDiagnoses', 'activeMedications', 'dischargeMedications', 'followUpAppointments',
  'pendingTests', 'medicalEquipmentNeeds', 'patientEducationProvided',
  // OBJECT (root — dotted sub-paths validated against OBJECT_ROOTS below)
  'homeHealthServices', 'caregiverInformation', 'advanceDirectives', 'socialDeterminants',
];

// OBJECT fields edited via dotted sub-paths, e.g. "homeHealthServices.agency",
// "advanceDirectives.POLST". The leaf segment is free-form (keys vary per record),
// so we authorize any path whose root is one of these object fields.
const OBJECT_ROOTS = ['homeHealthServices', 'caregiverInformation', 'advanceDirectives', 'socialDeterminants'];

function isFieldAllowed(field) {
  if (ALLOWED_FIELDS.includes(field)) return true;
  const dot = field.indexOf('.');
  if (dot === -1) return false;
  const root = field.slice(0, dot);
  return OBJECT_ROOTS.includes(root);
}

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params; const { field, value, arrayIndex } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    if (!isFieldAllowed(field)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    // For dotted object sub-paths, track the root field name in editedFields.
    const editedFieldName = field.indexOf('.') === -1 ? field : field.slice(0, field.indexOf('.'));
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = { $set: { [`${field}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': editedFieldName } };
    } else {
      updateOp = { $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id }, $addToSet: { 'doctorEdits.editedFields': editedFieldName } };
    }
    await sda.update('care_coordination', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) { console.error('[CareCoord] PUT /:id/edit error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params; const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess(); const context = buildContext(req, 'write');
    await sda.update('care_coordination', { _id: objectId }, { $set: { 'doctorEdits.approvedAt': new Date(), 'doctorEdits.approvedBy': req.user?.id, 'doctorEdits.status': 'approved' } }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) { console.error('[CareCoord] PUT /:id/approve error:', err.message); return res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
