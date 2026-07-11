/**
 * Administrative Data Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/administrative_data/:id/edit    — Edit a single field on an administrative data record
 * PUT /api/edit/administrative_data/:id/approve — Approve all pending edits
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { practiceAuth } = require('../../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../../middleware/practiceContext');

// Lazy-loaded service
let secureDataAccess;
function getSecureDataAccess() {
  if (!secureDataAccess) secureDataAccess = require('../../services/secureDataAccess');
  return secureDataAccess;
}

// Middleware: context -> models -> auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'administrative-data-edit-service',
    userId: req.user?.id,
    operation,
    practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId,
    permissions: [operation === 'read' ? 'read' : 'write'],
  };
}

function toObjectId(str) {
  try {
    return new mongoose.Types.ObjectId(str);
  } catch {
    return null;
  }
}

// Allowed editable fields for administrative_data
const ALLOWED_FIELDS = [
  // Patient Identifiers
  'mrn', 'accountNumber', 'insurance',
  // Clinical text fields
  'findings', 'assessment', 'plan', 'notes',
  // Clinical Status
  'disposition', 'conditionAtDischarge', 'dietaryInstructions', 'status',
  // Hospital Stay
  'lengthOfStay', 'admittingDiagnosis',
  // Consultation & Referral
  'consultingPhysician', 'consultingSpecialty',
  'referringPhysician', 'referringSpecialty', 'reasonForConsult',
  // Emergency Contacts & Legal
  'primaryCareProvider', 'emergencyContact', 'codeStatus', 'powerOfAttorney',
  // Signatures & Documentation
  'category', 'type', 'provider', 'facility',
  'facilityName', 'facilityAddress', 'electronicSignature', 'electronicSignatureFull',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[AdministrativeData] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[AdministrativeData] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Support nested field paths — validate parent field
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid administrative data record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[AdministrativeData] context:', JSON.stringify(context));

    // Support arrayIndex for array fields
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('administrative_data', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[AdministrativeData] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[AdministrativeData] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Administrative data record not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[AdministrativeData] PUT /:id/edit error:', err.message);
    console.error('[AdministrativeData] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid administrative data record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('administrative_data', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[AdministrativeData] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
