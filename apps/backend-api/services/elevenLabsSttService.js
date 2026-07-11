/**
 * ElevenLabs Speech-to-Text Service
 * Manages WebSocket connections to ElevenLabs Scribe v2 Realtime API
 * for real-time audio transcription during patient visits.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class ElevenLabsSttService {
  constructor() {
    this.apiKey = null;
    this.initialized = false;
    this.activeSessions = new Map();
  }

  async initialize() {
    try {
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      this.apiKey = await productionKMS.getInternalKey('elevenlabs_api_key');

      if (!this.apiKey) {
        console.warn('⚠️ ElevenLabs API key not found in KMS — STT service will be unavailable');
        this.initialized = true;
        return;
      }

      this.initialized = true;
      console.log('✅ ElevenLabsSttService initialized');
    } catch (error) {
      console.error('❌ ElevenLabsSttService initialization failed:', error.message);
      this.initialized = true;
    }
  }

  isAvailable() {
    return this.initialized && !!this.apiKey;
  }

  createRealtimeSession(options = {}) {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs STT service not available — missing API key');
    }

    const { visitId, sessionId, language } = options;
    const id = visitId || sessionId;
    if (!id) throw new Error('visitId or sessionId is required');

    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      enable_logging: 'false',
      commit_strategy: 'vad',
      vad_silence_threshold_secs: '1.0',
      audio_format: 'pcm_16000',
    });
    if (language) params.set('language_code', language);

    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
    console.log(`[ElevenLabs STT] Connecting to: ${wsUrl}`);

    const session = new RealtimeSession(wsUrl, this.apiKey, id);
    this.activeSessions.set(id, session);

    session.on('close', () => {
      this.activeSessions.delete(id);
    });

    return session;
  }

  getSession(visitId) {
    return this.activeSessions.get(visitId) || null;
  }

  closeAll() {
    for (const [visitId, session] of this.activeSessions) {
      try { session.close(); } catch (e) { /* ignore */ }
    }
    this.activeSessions.clear();
  }
}

class RealtimeSession extends EventEmitter {
  constructor(wsUrl, apiKey, visitId) {
    super();
    this.visitId = visitId;
    this.ws = null;
    this.connected = false;
    this.segments = [];
    this.fullText = '';
    this._connect(wsUrl, apiKey);
  }

  _connect(wsUrl, apiKey) {
    this.ws = new WebSocket(wsUrl, {
      headers: { 'xi-api-key': apiKey }
    });

    this.ws.on('open', () => {
      this.connected = true;
      console.log(`[ElevenLabs STT] WebSocket OPEN for ${this.visitId}`);
      this.emit('session_started', { visitId: this.visitId });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[ElevenLabs STT] Received:`, msg.message_type || msg.type, msg.text ? msg.text.substring(0, 60) : '');
        this._handleMessage(msg);
      } catch (err) {
        console.error(`[ElevenLabs STT] Parse error for visit ${this.visitId}:`, err.message);
      }
    });

    this.ws.on('error', (err) => {
      console.error(`[ElevenLabs STT] WebSocket error for visit ${this.visitId}:`, err.message);
      this.emit('error', { type: 'websocket_error', error: err.message });
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ElevenLabs STT] WebSocket CLOSED for ${this.visitId}: code=${code} reason=${reason?.toString()}`);
      this.connected = false;
      this.emit('close', { code, reason: reason?.toString() });
    });
  }

  _handleMessage(msg) {
    const msgType = msg.message_type || msg.type;

    switch (msgType) {
      case 'session_started':
        // Session confirmed by ElevenLabs
        break;

      case 'partial_transcript':
        this.emit('partial', { text: msg.text || '' });
        break;

      case 'committed_transcript':
      case 'committed_transcript_with_timestamps': {
        const segment = {
          text: msg.text || '',
          start: 0,
          end: 0,
          confidence: 1,
          speaker: msg.speaker || 'unknown',
        };
        // Extract timestamps from words array if available
        if (msg.words && msg.words.length > 0) {
          segment.start = msg.words[0].start || 0;
          segment.end = msg.words[msg.words.length - 1].end || 0;
        }
        this.segments.push(segment);
        this.fullText += (this.fullText ? ' ' : '') + segment.text;
        this.emit('committed', segment);
        break;
      }

      case 'error':
      case 'auth_error':
      case 'quota_exceeded':
        this.emit('error', {
          type: msgType,
          error: msg.message || msg.error || 'Unknown ElevenLabs error',
        });
        break;

      default:
        break;
    }
  }

  sendAudio(base64Audio) {
    if (!this.connected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: base64Audio,
        commit: false,
        sample_rate: 16000,
      }));
    } catch (err) {
      console.error(`[ElevenLabs STT] Send error for visit ${this.visitId}:`, err.message);
    }
  }

  /** Send a final commit to flush any remaining audio before closing */
  sendCommit() {
    if (!this.connected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: '',
        commit: true,
        sample_rate: 16000,
      }));
    } catch (err) {
      console.error(`[ElevenLabs STT] Commit error for visit ${this.visitId}:`, err.message);
    }
  }

  close() {
    if (this.ws) {
      try {
        // Send final commit to flush any remaining audio
        this.sendCommit();
        this.ws.close();
      } catch (e) { /* ignore */ }
      this.ws = null;
    }
    this.connected = false;
    return {
      fullText: this.fullText,
      segments: this.segments,
      language: 'en',
    };
  }

  getTranscript() {
    return { fullText: this.fullText, segments: [...this.segments] };
  }
}

module.exports = new ElevenLabsSttService();
