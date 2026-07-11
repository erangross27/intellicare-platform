/**
 * Imaging Reports Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/imaging_reports/:id/edit    — Edit a single field on an imaging report
 * PUT /api/edit/imaging_reports/:id/approve — Approve all pending edits
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
    serviceId: 'imaging-reports-edit-service',
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

// Allowed editable fields for imaging_reports
const ALLOWED_FIELDS = [
  'imagingType', 'bodyPart', 'technique', 'findings',
  'impression', 'comparison', 'radiologist', 'facility',
  'date', 'criticalFindings',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;

    console.log('[ImagingReports] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value);
    console.log('[ImagingReports] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid imaging report ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[ImagingReports] context:', JSON.stringify(context));

    const setFields = {
      [field]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('imaging_reports', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[ImagingReports] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[ImagingReports] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Imaging report not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[ImagingReports] PUT /:id/edit error:', err.message);
    console.error('[ImagingReports] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid imaging report ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('imaging_reports', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[ImagingReports] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
