/**
 * Lab Results Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/lab_results/:id/edit    — Edit a single field on a lab result
 * PUT /api/edit/lab_results/:id/approve — Approve all pending edits
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

// Middleware: context → models → auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'lab-results-edit-service',
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

// Allowed editable fields for lab_results
// (dates and biomarkerTrend render read-only in the template, so they are not editable here)
const ALLOWED_FIELDS = [
  'testName', 'value', 'unit', 'referenceRange',
  'flag', 'interpretation', 'results',
  'timing', 'clinicalSignificance', 'specimenType', 'methodology',
  'deltaFromPrevious', 'orderingProvider', 'labName', 'interpretiveComments',
];

// ─── PUT /:id/edit — Edit a single field ──────────────────────────────────────

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[LabResults] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[LabResults] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid lab result ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[LabResults] context:', JSON.stringify(context));

    // Support array element editing (e.g., results.0, results.1)
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const editedFieldName = (typeof arrayIndex === 'number') ? `${field}[${arrayIndex}]` : field;

    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('lab_results', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': editedFieldName },
    }, context);

    console.log('[LabResults] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[LabResults] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Lab result not found in database' });
    }

    return res.json({ success: true, labResultId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[LabResults] PUT /:id/edit error:', err.message);
    console.error('[LabResults] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:id/approve — Approve all pending edits ─────────────────────────────

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid lab result ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('lab_results', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, labResultId: id, status: 'approved' });
  } catch (err) {
    console.error('[LabResults] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
