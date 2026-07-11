/**
 * Code Blue Summaries Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance
 *
 * PUT /api/edit/code_blue_summaries/:id/edit    — Edit a single field
 * PUT /api/edit/code_blue_summaries/:id/approve — Approve a section
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

const ALLOWED_FIELDS = [
  'codeBlueActivationTime',
  'locationOfCodeBlue',
  'initialRhythm',
  'cprStartTime',
  'cprEndTime',
  'totalCprDuration',
  'numberOfDefibrillations',
  'epinephrineAdministered',
  'epinephrineDoses',
  'acslsProtocolFollowed',
  'returnOfSpontaneousCirculation',
  'roscTime',
  'timeToRosc',
  'endTidalCo2',
  'intubationPerformed',
  'intubationAttempts',
  'vasopressorsAdministered',
  'amiodaroneAdministered',
  'sodiumBicarbonateGiven',
  'codeBlueOutcome',
  'witnessedArrest',
  'teamLeaderRole',
  'precipitatingFactor',
  'utsteincriteriaMet',
  'targetedTemperatureManagement',
];

// Typed fields — coerce incoming values to the correct BSON type so a
// stray string from the client never corrupts the stored type.
const NUMBER_FIELDS = [
  'totalCprDuration', 'numberOfDefibrillations', 'epinephrineDoses',
  'timeToRosc', 'endTidalCo2', 'intubationAttempts',
];
const BOOLEAN_FIELDS = [
  'epinephrineAdministered', 'acslsProtocolFollowed', 'returnOfSpontaneousCirculation',
  'intubationPerformed', 'amiodaroneAdministered', 'sodiumBicarbonateGiven',
  'witnessedArrest', 'utsteincriteriaMet', 'targetedTemperatureManagement',
];

// Returns { ok, value } — ok=false signals a type-validation failure.
function coerceFieldValue(field, value) {
  if (NUMBER_FIELDS.includes(field)) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(num)) return { ok: false };
    return { ok: true, value: num };
  }
  if (BOOLEAN_FIELDS.includes(field)) {
    if (typeof value === 'boolean') return { ok: true, value };
    if (value === 'true' || value === 'Yes') return { ok: true, value: true };
    if (value === 'false' || value === 'No') return { ok: true, value: false };
    return { ok: false };
  }
  return { ok: true, value };
}

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'code-blue-summaries-edit-service',
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

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value, arrayIndex } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ success: false, error: 'field and value are required' });
    }

    if (!ALLOWED_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, error: `Field "${field}" is not editable` });
    }

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    if (arrayIndex !== undefined && arrayIndex !== null) {
      // Array element edits target string arrays (e.g. vasopressorsAdministered) — store as-is.
      await sda.update('code_blue_summaries', { _id: objectId }, {
        $set: {
          [`${field}.${arrayIndex}`]: value,
          updatedAt: new Date(),
          updatedBy: req.user?.id,
        },
      }, context);
    } else {
      const coerced = coerceFieldValue(field, value);
      if (!coerced.ok) {
        return res.status(400).json({ success: false, error: `Invalid value for field "${field}"` });
      }
      await sda.update('code_blue_summaries', { _id: objectId }, {
        $set: {
          [field]: coerced.value,
          updatedAt: new Date(),
          updatedBy: req.user?.id,
        },
      }, context);
    }

    return res.json({ success: true, recordId: id, editedField: field });
  } catch (err) {
    console.error('[CodeBlueSummaries] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionId, approved } = req.body;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid record ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('code_blue_summaries', { _id: objectId }, {
      $set: {
        [`approvedSections.${sectionId}`]: approved,
        approvalTimestamp: new Date(),
        approvedBy: req.user?.id,
      },
    }, context);

    return res.json({ success: true, recordId: id, sectionId, status: approved ? 'approved' : 'pending' });
  } catch (err) {
    console.error('[CodeBlueSummaries] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
