/**
 * ElevenLabs Text-to-Speech Service
 * Streams agent text responses as audio via ElevenLabs TTS API.
 * Also provides voice/model listing for the settings UI.
 * API key loaded from productionKMS (same pattern as elevenLabsSttService).
 */

const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

class ElevenLabsTtsService {
  constructor() {
    this.client = null;
    this.voiceId = null;
    this.initialized = false;
    // Cache for voices and models (1 hour TTL)
    this._voicesCache = null;
    this._voicesCacheTime = 0;
    this._modelsCache = null;
    this._modelsCacheTime = 0;
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour
  }

  async initialize() {
    try {
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }

      const apiKey = await productionKMS.getInternalKey('elevenlabs_api_key');
      if (!apiKey) {
        console.warn('ElevenLabs API key not found in KMS — TTS service will be unavailable');
        this.initialized = true;
        return;
      }

      this.client = new ElevenLabsClient({ apiKey });

      // Default voice — can be overridden per-request or via KMS key 'elevenlabs_voice_id'
      const customVoiceId = await productionKMS.getInternalKey('elevenlabs_voice_id');
      this.voiceId = customVoiceId || 'JBFqnCBsd6RMkjVDRZzb';

      this.initialized = true;
      console.log('ElevenLabsTtsService initialized');
    } catch (error) {
      console.error('ElevenLabsTtsService initialization failed:', error.message);
      this.initialized = true;
    }
  }

  isAvailable() {
    return this.initialized && !!this.client;
  }

  /**
   * Get all available voices from ElevenLabs (cached 1 hour).
   * Returns a simplified list suitable for the settings UI.
   */
  async getVoices() {
    if (!this.isAvailable()) {
      throw new Error('TTS service not available');
    }

    const now = Date.now();
    if (this._voicesCache && (now - this._voicesCacheTime) < this.CACHE_TTL) {
      return this._voicesCache;
    }

    console.log('[TTS] Fetching voices from ElevenLabs...');
    const allVoices = [];
    let nextPageToken = undefined;

    // Paginate through all voices (max 100 per page)
    do {
      const page = await this.client.voices.search({
        pageSize: 100,
        ...(nextPageToken && { nextPageToken }),
      });

      if (page.voices && page.voices.length > 0) {
        for (const v of page.voices) {
          allVoices.push({
            voice_id: v.voiceId,
            name: v.name,
            category: v.category,
            labels: v.labels || {},
            preview_url: v.previewUrl,
            description: v.description,
          });
        }
      }

      nextPageToken = page.hasMore ? page.nextPageToken : undefined;
    } while (nextPageToken);

    console.log(`[TTS] Fetched ${allVoices.length} voices`);
    this._voicesCache = allVoices;
    this._voicesCacheTime = now;
    return allVoices;
  }

  /**
   * Get all available TTS models from ElevenLabs (cached 1 hour).
   * Filters to only models that support text-to-speech.
   */
  async getModels() {
    if (!this.isAvailable()) {
      throw new Error('TTS service not available');
    }

    const now = Date.now();
    if (this._modelsCache && (now - this._modelsCacheTime) < this.CACHE_TTL) {
      return this._modelsCache;
    }

    console.log('[TTS] Fetching models from ElevenLabs...');
    const allModels = await this.client.models.list();

    // Filter to TTS-capable models and simplify
    const ttsModels = allModels
      .filter(m => m.canDoTextToSpeech)
      .map(m => ({
        model_id: m.modelId,
        name: m.name,
        description: m.description,
        languages: (m.languages || []).map(l => ({
          language_id: l.languageId,
          name: l.name,
        })),
      }));

    console.log(`[TTS] Fetched ${ttsModels.length} TTS models`);
    this._modelsCache = ttsModels;
    this._modelsCacheTime = now;
    return ttsModels;
  }

  /**
   * Stream text as audio to an Express response.
   * Uses textToSpeech.convert() with getReader() — the documented ElevenLabs pattern.
   * @param {string} text - The text to convert to speech
   * @param {object} res - Express response object
   * @param {object} [options] - Optional overrides
   * @param {string} [options.voiceId] - Override default voice
   * @param {string} [options.modelId] - Override default model
   */
  async streamSpeech(text, res, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('TTS service not available');
    }

    const voiceId = options.voiceId || this.voiceId;
    const modelId = options.modelId || 'eleven_turbo_v2_5';

    console.log(`[TTS] Converting text to speech: voiceId=${voiceId}, model=${modelId}, text="${text.substring(0, 60)}..."`);

    const audio = await this.client.textToSpeech.convert(voiceId, {
      text,
      modelId,
      outputFormat: 'mp3_44100_128',
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Stop consuming ElevenLabs stream if client disconnects (saves API quota)
    let clientDisconnected = false;
    res.on('close', () => { clientDisconnected = true; });

    // Use getReader() pattern from ElevenLabs docs (convert returns ReadableStream)
    const reader = audio.getReader();
    let totalBytes = 0;
    while (true) {
      if (clientDisconnected || res.writableEnded) break;
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      res.write(Buffer.from(value));
    }

    console.log(`[TTS] Stream complete — ${totalBytes} bytes sent`);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

module.exports = new ElevenLabsTtsService();
