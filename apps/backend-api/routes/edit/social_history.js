/**
 * Social History Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/social_history/:id/edit    — Edit a single field on a social history record
 * PUT /api/edit/social_history/:id/approve — Approve all pending edits
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
    serviceId: 'social-history-edit-service',
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

// Allowed editable fields for social_history
// Array fields (drugTypes, occupationalExposures) support arrayIndex for element-level edits
const ALLOWED_FIELDS = [
  'date', 'type', 'provider', 'facility',
  'smokingStatus', 'smokingHistory', 'packYearsHistory', 'tobaccoType',
  'alcoholUse', 'alcoholFrequency', 'alcoholQuantity',
  'illicitDrugUse', 'substanceUse', 'drugTypes',
  'housingStability', 'householdMembers', 'homeEnvironment', 'livingSituation', 'livesAlone',
  'employmentStatus', 'occupation', 'occupationalExposures',
  'educationLevel', 'healthLiteracy',
  'maritalStatus', 'caregiverStatus', 'familySupport', 'supportSystem',
  'physicalActivityLevel', 'exercise', 'diet', 'sleepPatterns', 'stressLevel',
  'religiousBeliefs', 'culturalFactors', 'sexualOrientation', 'sexualActivity', 'contraceptionMethod',
  'transportation', 'foodSecurity', 'domesticViolence', 'recentTravel', 'militaryService',
  'insurance', 'financialConcerns',
  'notes',
  // Clinical narrative + structured fields
  'findings', 'assessment', 'plan', 'recommendations', 'results', 'status',
];

// --- PUT /:id/edit --- Edit a single field ----------------------------------------

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    console.log('[SocialHistory] PUT /:id/edit called — id:', id, 'field:', field, 'value:', value, 'arrayIndex:', arrayIndex);
    console.log('[SocialHistory] practiceContext:', req.practiceContext?.subdomain, 'user:', req.user?.id);

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    // Support nested field paths like 'provider.name' — validate parent field
    const parentField = field.includes('.') ? field.split('.')[0] : field;
    if (!ALLOWED_FIELDS.includes(parentField)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid social history record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');
    console.log('[SocialHistory] context:', JSON.stringify(context));

    // Support arrayIndex for array fields (drugTypes, occupationalExposures)
    const fieldPath = (typeof arrayIndex === 'number') ? `${field}.${arrayIndex}` : field;
    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('social_history', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': field },
    }, context);

    console.log('[SocialHistory] update result:', JSON.stringify(result));

    if (result.matchedCount === 0) {
      console.error('[SocialHistory] WARNING: No documents matched _id:', id);
      return res.status(404).json({ success: false, error: 'Social history record not found in database' });
    }

    return res.json({ success: true, reportId: id, editedField: field, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[SocialHistory] PUT /:id/edit error:', err.message);
    console.error('[SocialHistory] Full error:', err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- PUT /:id/approve --- Approve all pending edits -------------------------------

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid social history record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('social_history', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, reportId: id, status: 'approved' });
  } catch (err) {
    console.error('[SocialHistory] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
