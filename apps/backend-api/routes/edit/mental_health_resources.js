/**
 * Mental Health Resources Edit Route
 * Isolated per-collection edit/approve endpoints for HIPAA compliance.
 *
 * PUT /api/edit/mental_health_resources/:id/edit    — Edit a single field (or array element via arrayIndex)
 * PUT /api/edit/mental_health_resources/:id/approve — Approve all pending edits
 *
 * Uses the canonical secureDataAccess API: sda.update(collection, filter, updateObj, context).
 * (Mirrors medications.js / lab_results.js — persists via the canonical sda.update API.)
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
    serviceId: 'mental-health-resources-edit-service',
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

// 23 extractable unified-schema fields for mental_health_resources.
const ALLOWED_FIELDS = [
  // Section 1 — Psychiatric Rating Scales (numeric)
  'gafScore', 'phr9Score', 'gad7Score', 'mdrsScore', 'hamiltonAnxietyScore',
  'panssPositiveScore', 'panssNegativeScore', 'ymrsScore', 'miniMentalStateScore',
  'columbiaRiskScore', 'traumaScreeningScore',
  // Section 2 — Diagnostic Formulation (arrays)
  'dsmFiveAxisDiagnosis', 'icd11MentalHealthCodes',
  // Section 3 — Current Psychotropic Medications (array)
  'currentPsychotropicMedications',
  // Section 4 — Clinical Assessment (strings)
  'mentalStatusExamination', 'functionalImpairmentLevel', 'substanceUseScreeningResult',
  'treatmentComplianceStatus', 'psychotherapyModalityType',
  // Section 5 — Risk & Safety (string + array)
  'crisisInterventionPlan', 'riskFactorIdentification',
  // Section 6 — Support & Recovery (string + array)
  'socialSupportNetworkAssessment', 'recoveryGoalsAndTargets',
];

// Array fields that support per-item arrayIndex editing.
const ARRAY_FIELDS = ['dsmFiveAxisDiagnosis', 'icd11MentalHealthCodes', 'currentPsychotropicMedications', 'riskFactorIdentification', 'recoveryGoalsAndTargets'];

// ─── PUT /:id/edit — Edit a single field (or array element) ───────────────────

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
      return res.status(400).json({ success: false, error: 'Invalid mental health resources ID' });
    }

    // Support array element editing (e.g., dsmFiveAxisDiagnosis.0)
    let fieldPath = field;
    let editedFieldName = field;
    if (typeof arrayIndex === 'number') {
      if (!ARRAY_FIELDS.includes(field)) {
        return res.status(400).json({ success: false, error: `Field "${field}" does not support arrayIndex editing` });
      }
      fieldPath = `${field}.${arrayIndex}`;
      editedFieldName = `${field}[${arrayIndex}]`;
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const setFields = {
      [fieldPath]: value,
      'doctorEdits.editedAt': new Date(),
      'doctorEdits.editedBy': req.user?.id,
    };

    const result = await sda.update('mental_health_resources', { _id: objectId }, {
      $set: setFields,
      $addToSet: { 'doctorEdits.editedFields': editedFieldName },
    }, context);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Mental health resources record not found' });
    }

    return res.json({ success: true, mentalHealthResourcesId: id, editedField: editedFieldName, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[MentalHealthResources] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:id/approve — Approve all pending edits ─────────────────────────────

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const objectId = toObjectId(id);
    if (!objectId) {
      return res.status(400).json({ success: false, error: 'Invalid mental health resources ID' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update('mental_health_resources', { _id: objectId }, {
      $set: {
        'doctorEdits.approvedAt': new Date(),
        'doctorEdits.approvedBy': req.user?.id,
        'doctorEdits.status': 'approved',
      },
    }, context);

    return res.json({ success: true, mentalHealthResourcesId: id, status: 'approved' });
  } catch (err) {
    console.error('[MentalHealthResources] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
