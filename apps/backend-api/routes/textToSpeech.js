/**
 * Text-to-Speech Routes
 * POST /api/tts/speak — streams agent text as audio via ElevenLabs TTS.
 * GET  /api/tts/voices — lists all available ElevenLabs voices.
 * GET  /api/tts/models — lists all TTS-capable ElevenLabs models.
 */

const express = require('express');
const router = express.Router();
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');

// Apply middleware
router.use(practiceContext);
router.use(practiceAuth);

// Lazy-load TTS service to avoid circular dependencies
let ttsService;
function getTtsService() {
  if (!ttsService) ttsService = require('../services/elevenLabsTtsService');
  return ttsService;
}

/**
 * GET /api/tts/voices
 * Returns all available ElevenLabs voices (cached 1 hour server-side).
 */
router.get('/voices', async (req, res) => {
  try {
    const svc = getTtsService();
    if (!svc.isAvailable()) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }
    const voices = await svc.getVoices();
    res.json({ voices });
  } catch (err) {
    console.error('[TTS Route] GET /voices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

/**
 * GET /api/tts/models
 * Returns all TTS-capable ElevenLabs models (cached 1 hour server-side).
 */
router.get('/models', async (req, res) => {
  try {
    const svc = getTtsService();
    if (!svc.isAvailable()) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }
    const models = await svc.getModels();
    res.json({ models });
  } catch (err) {
    console.error('[TTS Route] GET /models error:', err.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * POST /api/tts/speak
 * Body: { text: string, voiceId?: string, modelId?: string }
 * Response: audio/mpeg stream
 */
router.post('/speak', async (req, res) => {
  console.log('[TTS Route] POST /speak received, text length:', req.body?.text?.length || 0);
  try {
    const { text, voiceId, modelId } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.warn('[TTS Route] Missing or empty text');
      return res.status(400).json({ error: 'text is required' });
    }

    const svc = getTtsService();
    if (!svc.isAvailable()) {
      console.warn('[TTS Route] TTS service not available (not initialized or no API key)');
      return res.status(503).json({ error: 'TTS service unavailable' });
    }

    await svc.streamSpeech(text.trim(), res, {
      ...(voiceId && { voiceId }),
      ...(modelId && { modelId }),
    });
  } catch (err) {
    console.error('[TTS Route] POST /speak error:', err.message, err.stack);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'TTS streaming failed' });
    }
  }
});

module.exports = router;
