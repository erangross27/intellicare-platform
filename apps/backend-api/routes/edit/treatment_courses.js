/**
 * Treatment Courses Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/treatment_courses/:id/edit    — Edit a single field on a treatment course record
 * PUT /api/edit/treatment_courses/:id/approve — Approve all pending edits
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
    serviceId: 'treatment-courses-edit-service',
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

// Allowed editable fields for treatment_courses
const ALLOWED_FIELDS = [
  'date', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan',
  'recommendations', 'results', 'notes', 'status', 'reportType',
  'clinicalIndication', 'urgency', 'followUp', 'reportDate',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    const rootField = field.split('.')[0];
    if (!ALLOWED_FIELDS.includes(rootField)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid treatment course ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('treatment_courses', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    if (result.matchedCount === 0) {
      console.error('[TreatmentCourses] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Treatment course record not found in database' });
    }

    return res.json({ success: true, recordId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[TreatmentCourses] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid treatment course ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const result = await sda.update('treatment_courses', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    if (result.matchedCount === 0) return res.status(404).json({ success: false, error: 'Treatment course record not found in database' });
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) {
    console.error('[TreatmentCourses] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
