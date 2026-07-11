/**
 * Prognosis Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/prognosis/:id/edit    — Edit a single field
 * PUT /api/edit/prognosis/:id/approve — Approve all pending edits
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
    serviceId: 'prognosis-edit-service',
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

// Allowed editable fields (parent roots)
const ALLOWED_FIELDS = [
  'shortTerm',
  'longTerm',
  'motivationFactors',
  'previousTreatmentResponse',
  'insightLevel',
  'mortality',
  'functionalStatus',
  'provider',
  'findings',
  'assessment',
  'plan',
  'notes',
  'riskFactors',
  'protectiveFactors',
  'recommendations',
  'results',
];

// Allow-listed subfields for the recommendations array-of-objects ({recommendation, date}).
// Editing an array-of-objects must target a leaf subfield (recommendations.<idx>.<subField>)
// to preserve the object shape on save — never overwrite the whole object with a flat string.
const RECOMMENDATIONS_SUBFIELDS = ['recommendation', 'date', 'text', 'value'];

/**
 * Validate a (possibly dot-pathed) field against the allow-list.
 * - Plain field: must be in ALLOWED_FIELDS.
 * - recommendations.<idx>.<subField>: subField must be allow-listed.
 * - recommendations.<idx>: scalar-array item edit allowed.
 * - results.<key>: dynamic-key object — any non-empty key allowed under the `results` root.
 * Returns true if editing this path is permitted.
 */
function isFieldEditable(field) {
  if (typeof field !== 'string' || !field) return false;
  const parts = field.split('.');
  const root = parts[0];
  if (!ALLOWED_FIELDS.includes(root)) return false;
  if (parts.length === 1) return true;

  if (root === 'recommendations') {
    // recommendations.<idx>  or  recommendations.<idx>.<subField>
    if (!/^\d+$/.test(parts[1])) return false;
    if (parts.length === 2) return true;
    if (parts.length === 3) return RECOMMENDATIONS_SUBFIELDS.includes(parts[2]);
    return false;
  }

  if (root === 'results') {
    // results.<dynamicKey> — single level, non-empty key only
    return parts.length === 2 && parts[1].length > 0;
  }

  if (root === 'riskFactors' || root === 'protectiveFactors') {
    // scalar-array item: <root>.<idx>
    return parts.length === 2 && /^\d+$/.test(parts[1]);
  }

  return false;
}

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Validate field path (root + allow-listed subfield/dot-path for object/array fields)
    if (!isFieldEditable(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Support arrayIndex for array fields
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('prognosis', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Record not found in database' });
    }

    return res.json({ success: true, recordId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[Prognosis] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('prognosis', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) {
    console.error('[Prognosis] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
