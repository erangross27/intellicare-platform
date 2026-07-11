/**
 * Colorectal Colonoscopies Edit Route
 * Collection: colorectal_colonoscopies (alias: colonoscopy_reports)
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

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'colorectal-colonoscopies-edit-service',
    userId: req.user?.id,
    operation,
    practiceId: req.practiceContext?.subdomain || req.practiceContext?.practiceId,
    permissions: [operation === 'read' ? 'read' : 'write'],
  };
}
function toObjectId(str) { try { return new mongoose.Types.ObjectId(str); } catch { return null; } }

const ALLOWED_FIELDS = [
  // DATE (2)
  'procedureDate',
  'previousColonoscopyDate',
  // NUMBER (2)
  'cecumIntubationTime',
  'withdrawalTime',
  // ARRAY (5)
  'polypDetails',
  'resectionMethod',
  'biopsyLocations',
  'significantFindings',
  'complications',
  // STRING (15)
  'provider',
  'facility',
  'indication',
  'bowelPrepQuality',
  'cecumReached',
  'sedationType',
  'polypsFound',
  'polypectomyPerformed',
  'biopsiesTaken',
  'pathologyFindings',
  'adenomaDetectionRate',
  'hemostasisRequired',
  'recommendedSurveillance',
  'procedureCompleteness',
  'photographicDocumentation',
];

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex, subField } = req.body;
    if (!field || value === undefined) return res.status(400).json({ success: false, error: 'field and value are required' });
    // parentField guard: object-array subfield edits may arrive as "field.N.sub" — allow-list the root.
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    let updateOp;
    if (arrayIndex !== undefined && arrayIndex !== null && subField) {
      // object-array per-subfield edit — PRESERVES object shape (never overwrites the object with a flat string)
      updateOp = {
        $set: { [`${parentField}.${arrayIndex}.${subField}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id },
        $addToSet: { 'doctorEdits.editedFields': parentField },
      };
    } else if (arrayIndex !== undefined && arrayIndex !== null) {
      updateOp = {
        $set: { [`${parentField}.${arrayIndex}`]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id },
        $addToSet: { 'doctorEdits.editedFields': parentField },
      };
    } else {
      updateOp = {
        $set: { [field]: value, 'doctorEdits.editedAt': new Date(), 'doctorEdits.editedBy': req.user?.id },
        $addToSet: { 'doctorEdits.editedFields': field },
      };
    }
    await sda.update('colorectal_colonoscopies', { _id: objectId }, updateOp, context);
    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[ColorectalColonoscopies] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id); if (!objectId) return res.status(400).json({ success: false, error: 'Invalid ID' });
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    await sda.update('colorectal_colonoscopies', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);
    return res.json({ success: true, recordId: id, status: 'approved' });
  } catch (err) {
    console.error('[ColorectalColonoscopies] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
