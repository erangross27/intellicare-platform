/**
 * Pulmonary Imaging Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/pulmonary_imaging/:id/edit    — Edit a single field on a pulmonary imaging record
 * PUT /api/edit/pulmonary_imaging/:id/approve — Approve all pending edits
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
    serviceId: 'pulmonary-imaging-edit-service',
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

// Allowed editable fields for pulmonary_imaging
const ALLOWED_FIELDS = [
  'chestXray', 'ctChest', 'ventilationPerfusion', 'pulmonaryAngiography',
  'findings', 'assessment', 'plan', 'results', 'notes',
  'type', 'provider', 'facility', 'recommendations', 'date',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[PulmonaryImaging] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[PulmonaryImaging] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Support dot-notation for sub-fields (e.g., recommendations.0)
    const parentField = field.includes('.') ? field.split('.')[0] : field;

    if (!ALLOWED_FIELDS.includes(parentField)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid pulmonary imaging record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[PulmonaryImaging] context:', JSON.stringify(context));

    let setFields;

    if (typeof arrayIndex === 'number') {
      // Array element edit (e.g., recommendations[0])
      setFields = {
        [`${parentField}.${arrayIndex}`]: value,
        'doctorEdits.editedAt': new Date(),
        'doctorEdits.editedBy': req.user?.id,
      };
    } else {
      setFields = {
        [field]: value,
        'doctorEdits.editedAt': new Date(),
        'doctorEdits.editedBy': req.user?.id,
      };
    }

    const result = await sda.update('pulmonary_imaging', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': parentField },
    }, context);

    console.log('[PulmonaryImaging] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[PulmonaryImaging] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Pulmonary imaging record not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[PulmonaryImaging] PUT /:id/edit error:', err.message);
    console.error('[PulmonaryImaging] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid pulmonary imaging record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('pulmonary_imaging', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[PulmonaryImaging] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
