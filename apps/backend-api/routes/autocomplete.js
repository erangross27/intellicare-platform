/**
 * Autocomplete Routes
 * AI-powered sentence completion for medical notes
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');

// Apply middleware: context → models → auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

// Lazy service loading
let productionKMS;
function getProductionKMS() {
  if (!productionKMS) productionKMS = require('../services/productionKMS');
  return productionKMS;
}

/**
 * POST /api/autocomplete/predict
 * Predict next words for medical note autocomplete using Claude Haiku
 */
router.post('/predict', async (req, res) => {
  try {
    const { text, patientId, visitTranscript, maxTokens = 50 } = req.body;

    if (!text || text.length < 10) {
      return res.json({ success: true, data: { prediction: '', confidence: 0 } });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const kms = getProductionKMS();
    const apiKey = await kms.getInternalKey('anthropic_api_key');
    const client = new Anthropic({ apiKey });

    // Build patient context if available
    let patientContext = '';
    if (patientId) {
      try {
        const secureDataAccess = require('../services/secureDataAccess');
        const dbName = req.practiceDbName;
        if (dbName) {
          const patient = await secureDataAccess.findOne(dbName, 'patients',
            { _id: new mongoose.Types.ObjectId(patientId) },
            { serviceId: 'autocomplete-service', permissions: ['read'] },
            { projection: { firstName: 1, lastName: 1, dateOfBirth: 1, gender: 1 } }
          );
          if (patient) {
            patientContext = `Patient: ${patient.firstName} ${patient.lastName}, DOB: ${patient.dateOfBirth}, Gender: ${patient.gender}`;
          }
        }
      } catch (e) { /* continue without patient context */ }
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' }, // effort low: latency-sensitive autocomplete
      system: `You are a medical autocomplete assistant. Complete the doctor's sentence naturally. Return ONLY the completion text, nothing else. Keep completions under 30 words. Use medical terminology appropriate for clinical notes.${patientContext ? '\n\n' + patientContext : ''}${visitTranscript ? '\n\nVisit transcript so far:\n' + visitTranscript.substring(0, 500) : ''}`,
      messages: [{ role: 'user', content: text }],
    });

    const prediction = response.content[0]?.text || '';

    res.json({
      success: true,
      data: {
        prediction: prediction.trim(),
        confidence: 0.85,
      }
    });
  } catch (error) {
    console.error('Autocomplete prediction failed:', error.message);
    res.json({ success: true, data: { prediction: '', confidence: 0 } });
  }
});

module.exports = router;
