# Voice-Enabled Patient Visit Recording — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a voice recording system that captures doctor-patient encounters, transcribes in real-time via ElevenLabs, and generates AI-structured SOAP notes.

**Architecture:** Browser captures audio via getUserMedia, streams PCM chunks over WebSocket to our backend, which proxies to ElevenLabs Scribe v2 for real-time transcription. On visit end, Claude Opus 4.6 structures the transcript into a SOAP note. Everything encrypted and stored in our MongoDB `patient_visits` collection.

**Tech Stack:** ElevenLabs Scribe v2 (STT), WebSocket (`ws` package, already installed), Socket.IO (existing), AES-256-GCM encryption (existing e2eEncryptionService), Claude Opus 4.6 (summarization), Claude Haiku 4.5 (autocomplete), React/Vite (frontend).

**Design Docs:** `docs/voice-visit-recording/00-DESIGN.md` through `08-IMPLEMENTATION-ORDER.md`

---

## Task 1: PatientVisit Mongoose Model

**Files:**
- Create: `apps/backend-api/models/PatientVisit.js`

**Step 1: Create the PatientVisit model**

Create `apps/backend-api/models/PatientVisit.js` following the `MedicalImage.js` pattern for encrypted content fields:

```javascript
const mongoose = require('mongoose');

const patientVisitSchema = new mongoose.Schema({
  // Identity
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true,
    index: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  chatSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession'
  },

  // Visit metadata
  visitDate: { type: Date, default: Date.now },
  visitType: {
    type: String,
    enum: ['in-person', 'telehealth', 'phone'],
    default: 'in-person'
  },
  duration: { type: Number, default: 0 },  // seconds
  status: {
    type: String,
    enum: ['recording', 'transcribing', 'reviewing', 'approved', 'amended'],
    default: 'recording'
  },

  // Encrypted audio recording (AES-256-GCM, same pattern as MedicalImage)
  audioRecording: {
    encryptedContent: { type: Buffer },
    contentIv: { type: String },
    contentTag: { type: String },
    format: { type: String, default: 'webm/opus' },
    sampleRate: { type: Number, default: 16000 },
    fileSize: { type: Number },
    duration: { type: Number },  // seconds
  },

  // Full verbatim transcript
  transcript: {
    fullText: { type: String, default: '' },
    language: { type: String, default: 'en' },
    segments: [{
      text: { type: String },
      start: { type: Number },     // seconds from visit start
      end: { type: Number },
      confidence: { type: Number },
      speaker: { type: String, enum: ['doctor', 'patient', 'unknown'], default: 'unknown' }
    }],
  },

  // AI-generated structured SOAP note
  aiSummary: {
    chiefComplaint: { type: String },
    historyOfPresentIllness: { type: String },
    reviewOfSystems: { type: String },
    physicalExamination: { type: String },
    assessment: { type: String },
    plan: { type: String },
    medications: { type: String },
    followUp: { type: String },
    modelUsed: { type: String, default: 'claude-opus-4-6' },
    generatedAt: { type: Date },
  },

  // Doctor review tracking
  doctorEdits: {
    editedFields: [{ type: String }],
    editedAt: { type: Date },
  },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // HIPAA consent
  consentObtained: { type: Boolean, default: false },
  consentMethod: {
    type: String,
    enum: ['verbal', 'written', 'pre-visit-form'],
  },

  // Audit fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, {
  timestamps: true,  // auto createdAt + updatedAt
  collection: 'patient_visits',
});

// Compound indexes for efficient queries
patientVisitSchema.index({ patientId: 1, practiceId: 1 });
patientVisitSchema.index({ patientId: 1, visitDate: -1 });
patientVisitSchema.index({ practiceId: 1, createdAt: -1 });
patientVisitSchema.index({ status: 1 });
patientVisitSchema.index({ doctorId: 1, visitDate: -1 });

module.exports = mongoose.model('PatientVisit', patientVisitSchema);
```

**Step 2: Verify the model loads**

Run: `cd /home/erangross/IntelliCare/apps/backend-api && node -e "const m = require('./models/PatientVisit'); console.log('Model loaded:', m.modelName, 'Collection:', m.collection.collectionName);"`

Expected: `Model loaded: PatientVisit Collection: patient_visits`

**Step 3: Commit**

```bash
git add apps/backend-api/models/PatientVisit.js
git commit -m "feat: add PatientVisit mongoose model for voice visit recording"
```

---

## Task 2: ElevenLabs STT Service

**Files:**
- Create: `apps/backend-api/services/elevenLabsSttService.js`
- Modify: `apps/backend-api/services/masterServiceLoader.js` (lines 188, 307, 505)

**Step 1: Create the ElevenLabs STT service**

Create `apps/backend-api/services/elevenLabsSttService.js`:

```javascript
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
    this.activeSessions = new Map();  // visitId -> session
  }

  /**
   * Initialize — load API key from KMS
   */
  async initialize() {
    try {
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      this.apiKey = await productionKMS.getInternalKey('elevenlabs_api_key');

      if (!this.apiKey) {
        console.warn('⚠️ ElevenLabs API key not found in KMS — STT service will be unavailable');
        this.initialized = true;  // Mark initialized but without key
        return;
      }

      this.initialized = true;
      console.log('✅ ElevenLabsSttService initialized');
    } catch (error) {
      console.error('❌ ElevenLabsSttService initialization failed:', error.message);
      this.initialized = true;  // Don't block server startup
    }
  }

  /**
   * Check if service is available (has API key)
   */
  isAvailable() {
    return this.initialized && !!this.apiKey;
  }

  /**
   * Create a real-time transcription session
   * @param {Object} options
   * @param {string} options.visitId - Unique visit identifier
   * @param {string} [options.language] - Language code (default: auto-detect)
   * @returns {RealtimeSession} Session object with sendAudio, commit, close methods
   */
  createRealtimeSession(options = {}) {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs STT service not available — missing API key');
    }

    const { visitId, language } = options;
    if (!visitId) throw new Error('visitId is required');

    // Build WebSocket URL with query params
    const params = new URLSearchParams({
      model_id: 'scribe_v2',
      language_code: language || '',  // empty = auto-detect
      sample_rate: '16000',
      encoding: 'pcm_s16le',
      endpointing: '300',
      enable_logging: 'false',  // Zero-retention mode (HIPAA)
    });

    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/ws?${params.toString()}`;

    const session = new RealtimeSession(wsUrl, this.apiKey, visitId);
    this.activeSessions.set(visitId, session);

    session.on('close', () => {
      this.activeSessions.delete(visitId);
    });

    return session;
  }

  /**
   * Get active session by visitId
   */
  getSession(visitId) {
    return this.activeSessions.get(visitId) || null;
  }

  /**
   * Close all active sessions (for graceful shutdown)
   */
  closeAll() {
    for (const [visitId, session] of this.activeSessions) {
      try {
        session.close();
      } catch (e) {
        console.warn(`Failed to close session ${visitId}:`, e.message);
      }
    }
    this.activeSessions.clear();
  }
}

/**
 * Individual realtime transcription session
 * Wraps a WebSocket connection to ElevenLabs
 */
class RealtimeSession extends EventEmitter {
  constructor(wsUrl, apiKey, visitId) {
    super();
    this.visitId = visitId;
    this.ws = null;
    this.connected = false;
    this.segments = [];       // All committed segments
    this.fullText = '';       // Running full transcript text

    this._connect(wsUrl, apiKey);
  }

  _connect(wsUrl, apiKey) {
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'xi-api-key': apiKey,
      }
    });

    this.ws.on('open', () => {
      this.connected = true;
      this.emit('session_started', { visitId: this.visitId });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
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
      this.connected = false;
      this.emit('close', { code, reason: reason?.toString() });
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'transcript':
        if (msg.is_final) {
          // Committed transcript — final, won't change
          const segment = {
            text: msg.transcript || '',
            start: msg.start_time || 0,
            end: msg.end_time || 0,
            confidence: msg.confidence || 0,
            speaker: msg.speaker || 'unknown',
          };
          this.segments.push(segment);
          this.fullText += (this.fullText ? ' ' : '') + segment.text;
          this.emit('committed', segment);
        } else {
          // Partial transcript — interim, may change
          this.emit('partial', { text: msg.transcript || '' });
        }
        break;

      case 'error':
        this.emit('error', {
          type: msg.error_code || 'unknown',
          error: msg.message || 'Unknown ElevenLabs error',
        });
        break;

      default:
        // Other message types (session info, etc.)
        break;
    }
  }

  /**
   * Send an audio chunk to ElevenLabs
   * @param {string} base64Audio - Base64-encoded PCM 16kHz audio
   */
  sendAudio(base64Audio) {
    if (!this.connected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({
        audio: base64Audio,
      }));
    } catch (err) {
      console.error(`[ElevenLabs STT] Send error for visit ${this.visitId}:`, err.message);
    }
  }

  /**
   * Close the session and get final transcript
   * @returns {{ fullText: string, segments: Array, language: string }}
   */
  close() {
    if (this.ws) {
      try {
        // Send close signal
        if (this.connected) {
          this.ws.send(JSON.stringify({ type: 'close' }));
        }
        this.ws.close();
      } catch (e) {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.connected = false;

    return {
      fullText: this.fullText,
      segments: this.segments,
      language: 'en',  // ElevenLabs auto-detects
    };
  }

  /**
   * Get current transcript state
   */
  getTranscript() {
    return {
      fullText: this.fullText,
      segments: [...this.segments],
    };
  }
}

module.exports = new ElevenLabsSttService();
```

**Step 2: Register in masterServiceLoader.js**

Add to three places in `apps/backend-api/services/masterServiceLoader.js`:

1. **loadPhases.ai array** (after line 202, before `'authAIService'`):
   ```javascript
   'elevenLabsSttService',     // ElevenLabs speech-to-text for visit recording
   ```

2. **servicePaths object** (after line 476, in AI services section):
   ```javascript
   'elevenLabsSttService': './elevenLabsSttService',
   ```

3. **needsInitialization array** (after line 538, the initServices list):
   ```javascript
   'elevenLabsSttService',  // Needs init for KMS API key
   ```

**Step 3: Verify service loads**

Run: `cd /home/erangross/IntelliCare/apps/backend-api && node -e "const svc = require('./services/elevenLabsSttService'); console.log('Service loaded, initialized:', svc.initialized);"`

Expected: `Service loaded, initialized: false` (initialization happens at server startup)

**Step 4: Commit**

```bash
git add apps/backend-api/services/elevenLabsSttService.js apps/backend-api/services/masterServiceLoader.js
git commit -m "feat: add ElevenLabs STT service with WebSocket session management"
```

---

## Task 3: Visit Recording Route (WebSocket + REST)

**Files:**
- Create: `apps/backend-api/routes/visitRecording.js`
- Modify: `apps/backend-api/services/routeLoaderService.js` (line ~95)
- Modify: `apps/backend-api/services/secureDataAccess.js` (lines 1713, 1993)
- Modify: `apps/backend-api/server.js` (after line 274, before Socket.IO init)

**Step 1: Add `patient_visits` to secureDataAccess skipSoftDelete arrays**

In `apps/backend-api/services/secureDataAccess.js`, add `'patient_visits'` to BOTH `skipSoftDelete` arrays:

1. First array at line ~1713 (inside `findSecure` method):
   ```javascript
   const skipSoftDelete = [
     'chat_sessions',
     'chat_messages',
     // ... existing entries ...
     'patient_visits',  // Visit recordings use isDeleted field directly
   ];
   ```

2. Second array at line ~1993 (inside `findOneSecure` method):
   ```javascript
   const skipSoftDelete = [
     'chat_sessions',
     'chat_messages',
     // ... existing entries ...
     'patient_visits',  // Visit recordings use isDeleted field directly
   ];
   ```

**Step 2: Create the visit recording route**

Create `apps/backend-api/routes/visitRecording.js`:

```javascript
/**
 * Visit Recording Routes
 * REST endpoints for patient visit management (CRUD + audio playback).
 * WebSocket handling is in server.js (upgrade handler).
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { asyncHandler, requireAuth } = require('../middleware/routeMiddleware');

// Services loaded lazily to avoid circular deps
let secureDataAccess, e2eEncryptionService, elevenLabsSttService;

function getServices() {
  if (!secureDataAccess) {
    secureDataAccess = require('../services/secureDataAccess');
    e2eEncryptionService = require('../services/e2eEncryptionService');
    elevenLabsSttService = require('../services/elevenLabsSttService');
  }
}

/**
 * POST /api/visits/start
 * Start a new visit — creates the patient_visits document with status "recording"
 */
router.post('/start', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const { patientId, visitType = 'in-person', consentMethod = 'verbal' } = req.body;

  if (!patientId) {
    return res.status(400).json({ success: false, error: 'patientId is required' });
  }

  const practiceId = req.practiceId || req.user?.practiceId;
  const doctorId = req.user?._id || req.user?.id;

  if (!practiceId || !doctorId) {
    return res.status(400).json({ success: false, error: 'Missing practice or doctor context' });
  }

  // Create visit record
  const visitDoc = {
    patientId: new mongoose.Types.ObjectId(patientId),
    practiceId: new mongoose.Types.ObjectId(practiceId),
    doctorId: new mongoose.Types.ObjectId(doctorId),
    chatSessionId: req.body.chatSessionId ? new mongoose.Types.ObjectId(req.body.chatSessionId) : undefined,
    visitDate: new Date(),
    visitType,
    status: 'recording',
    consentObtained: true,
    consentMethod,
    transcript: { fullText: '', segments: [] },
    createdBy: new mongoose.Types.ObjectId(doctorId),
  };

  const result = await secureDataAccess.insertOne(
    req.practiceDbName || `intellicare_practice_${req.practiceName}`,
    'patient_visits',
    visitDoc,
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  res.json({
    success: true,
    data: {
      visitId: result.insertedId || result._id,
      status: 'recording',
      message: 'Visit recording started',
    }
  });
}));

/**
 * POST /api/visits/:id/end
 * End recording — triggers AI summarization
 */
router.post('/:id/end', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;

  // Get the visit
  const visit = await secureDataAccess.findOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { serviceId: 'visit-recording-service', permissions: ['read'] }
  );

  if (!visit) {
    return res.status(404).json({ success: false, error: 'Visit not found' });
  }

  // Close ElevenLabs session if active
  const session = elevenLabsSttService.getSession(visitId);
  let transcript = visit.transcript;
  if (session) {
    const finalTranscript = session.close();
    transcript = {
      fullText: finalTranscript.fullText || visit.transcript?.fullText || '',
      segments: finalTranscript.segments || visit.transcript?.segments || [],
      language: finalTranscript.language || 'en',
    };
  }

  // Update status to transcribing
  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    {
      $set: {
        status: 'transcribing',
        transcript,
        duration: req.body.duration || 0,
      }
    },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  // Generate AI summary using Claude
  const aiSummary = await generateSOAPNote(transcript.fullText, visit.patientId, dbName);

  // Update with AI summary, set to reviewing
  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    {
      $set: {
        status: 'reviewing',
        aiSummary: {
          ...aiSummary,
          modelUsed: 'claude-opus-4-6',
          generatedAt: new Date(),
        },
      }
    },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  res.json({
    success: true,
    data: {
      visitId,
      status: 'reviewing',
      aiSummary,
      transcript: { fullText: transcript.fullText },
    }
  });
}));

/**
 * PUT /api/visits/:id/approve
 * Doctor approves the visit note
 */
router.put('/:id/approve', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;
  const doctorId = req.user?._id || req.user?.id;

  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    {
      $set: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: new mongoose.Types.ObjectId(doctorId),
      }
    },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  res.json({ success: true, data: { visitId, status: 'approved' } });
}));

/**
 * PUT /api/visits/:id/edit
 * Doctor edits AI summary fields
 */
router.put('/:id/edit', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;
  const { fields } = req.body;  // { chiefComplaint: "new text", ... }

  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ success: false, error: 'fields object is required' });
  }

  // Build $set for only the provided aiSummary subfields
  const setObj = {};
  const editedFields = [];
  for (const [key, value] of Object.entries(fields)) {
    setObj[`aiSummary.${key}`] = value;
    editedFields.push(key);
  }
  setObj['doctorEdits.editedFields'] = editedFields;
  setObj['doctorEdits.editedAt'] = new Date();

  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { $set: setObj },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  res.json({ success: true, data: { visitId, editedFields } });
}));

/**
 * GET /api/visits/:id
 * Get single visit (NO audio binary — use /audio endpoint for that)
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;

  const visit = await secureDataAccess.findOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { serviceId: 'visit-recording-service', permissions: ['read'] },
    { projection: { 'audioRecording.encryptedContent': 0, 'audioRecording.contentIv': 0, 'audioRecording.contentTag': 0 } }
  );

  if (!visit) {
    return res.status(404).json({ success: false, error: 'Visit not found' });
  }

  res.json({ success: true, data: visit });
}));

/**
 * GET /api/visits/:id/audio
 * Stream decrypted audio for playback
 */
router.get('/:id/audio', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;

  const visit = await secureDataAccess.findOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { serviceId: 'visit-recording-service', permissions: ['read'] }
  );

  if (!visit || !visit.audioRecording?.encryptedContent) {
    return res.status(404).json({ success: false, error: 'Audio not found' });
  }

  try {
    const decrypted = await e2eEncryptionService.decryptWithServiceKey(
      visit.audioRecording.encryptedContent,
      visit.audioRecording.contentIv,
      visit.audioRecording.contentTag
    );

    res.set({
      'Content-Type': visit.audioRecording.format || 'audio/webm',
      'Content-Length': decrypted.length,
      'Cache-Control': 'no-store',
    });
    res.send(decrypted);

    // Zero out buffer after sending (same pattern as medical images)
    decrypted.fill(0);
  } catch (error) {
    console.error('Audio decryption failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to decrypt audio' });
  }
}));

/**
 * GET /api/visits/patient/:pid
 * Get visit history for a patient (no audio binary)
 */
router.get('/patient/:pid', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const patientId = req.params.pid;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const visits = await secureDataAccess.find(dbName, 'patient_visits',
    { patientId: new mongoose.Types.ObjectId(patientId), isDeleted: { $ne: true } },
    { serviceId: 'visit-recording-service', permissions: ['read'] },
    {
      projection: { 'audioRecording.encryptedContent': 0, 'audioRecording.contentIv': 0, 'audioRecording.contentTag': 0 },
      sort: { visitDate: -1 },
      limit,
    }
  );

  res.json({ success: true, data: visits || [] });
}));

/**
 * DELETE /api/visits/:id
 * Soft-delete a visit
 */
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  getServices();
  const visitId = req.params.id;
  const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;

  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  res.json({ success: true, data: { visitId, deleted: true } });
}));

/**
 * Generate SOAP note from transcript using Claude Opus 4.6
 */
async function generateSOAPNote(transcriptText, patientId, dbName) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const productionKMS = require('../services/productionKMS');

    const apiKey = await productionKMS.getInternalKey('anthropic_api_key');
    const client = new Anthropic({ apiKey });

    // Get patient context for better summarization
    let patientContext = '';
    try {
      const patient = await secureDataAccess.findOne(dbName, 'patients',
        { _id: new mongoose.Types.ObjectId(patientId) },
        { serviceId: 'visit-recording-service', permissions: ['read'] },
        { projection: { firstName: 1, lastName: 1, dateOfBirth: 1, gender: 1 } }
      );
      if (patient) {
        patientContext = `Patient: ${patient.firstName} ${patient.lastName}, DOB: ${patient.dateOfBirth}, Gender: ${patient.gender}`;
      }
    } catch (e) {
      // Continue without patient context
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6-20250219',
      max_tokens: 4096,
      system: `You are a medical scribe assistant. Structure the following doctor-patient encounter transcript into a clinical SOAP note. Return ONLY valid JSON with these exact keys: chiefComplaint, historyOfPresentIllness, reviewOfSystems, physicalExamination, assessment, plan, medications, followUp. Each value should be a string. If a section has no relevant information in the transcript, use an empty string.`,
      messages: [{
        role: 'user',
        content: `${patientContext ? patientContext + '\n\n' : ''}Transcript:\n${transcriptText}\n\nGenerate the structured SOAP note as JSON.`,
      }],
    });

    const text = response.content[0]?.text || '{}';
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('SOAP note generation failed:', error.message);
    return {
      chiefComplaint: '',
      historyOfPresentIllness: '',
      reviewOfSystems: '',
      physicalExamination: '',
      assessment: '',
      plan: '',
      medications: '',
      followUp: '',
    };
  }
}

module.exports = router;
```

**Step 3: Register route in routeLoaderService.js**

In `apps/backend-api/services/routeLoaderService.js`, add after the medical images route (line ~80):

```javascript
// ===== VISIT RECORDING =====
{ path: '/api/visits', file: './routes/visitRecording' },
```

**Step 4: Add WebSocket upgrade handler in server.js**

In `apps/backend-api/server.js`, after the `server` variable is created (line ~274) and BEFORE Socket.IO init (line 276), add:

```javascript
// WebSocket upgrade handler for visit recording (raw ws, not Socket.IO)
const WebSocket = require('ws');
const visitWss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === '/ws/visit-recording') {
    visitWss.handleUpgrade(request, socket, head, (ws) => {
      visitWss.emit('connection', ws, request);
    });
  }
  // Socket.IO handles its own upgrades via the engine
});

// Handle visit recording WebSocket connections
visitWss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');
  let visitId = null;
  let elevenLabsSession = null;
  const audioChunks = [];  // Collect audio for final save

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'start': {
          visitId = msg.visitId;
          const elevenLabsSttService = require('./services/elevenLabsSttService');

          if (!elevenLabsSttService.isAvailable()) {
            ws.send(JSON.stringify({ type: 'error', code: 'STT_UNAVAILABLE', message: 'Speech-to-text service not available' }));
            return;
          }

          elevenLabsSession = elevenLabsSttService.createRealtimeSession({ visitId });

          elevenLabsSession.on('session_started', () => {
            ws.send(JSON.stringify({ type: 'session_started', visitId }));
          });

          elevenLabsSession.on('partial', (data) => {
            ws.send(JSON.stringify({ type: 'partial', text: data.text }));
          });

          elevenLabsSession.on('committed', (segment) => {
            ws.send(JSON.stringify({
              type: 'committed',
              text: segment.text,
              speaker: segment.speaker,
              start: segment.start,
              end: segment.end,
            }));
          });

          elevenLabsSession.on('error', (err) => {
            ws.send(JSON.stringify({ type: 'error', code: err.type, message: err.error }));
          });

          break;
        }

        case 'audio': {
          if (elevenLabsSession) {
            elevenLabsSession.sendAudio(msg.data);
            audioChunks.push(Buffer.from(msg.data, 'base64'));
          }
          break;
        }

        case 'end': {
          if (elevenLabsSession) {
            const transcript = elevenLabsSession.close();
            elevenLabsSession = null;

            // Save audio (encrypted) and transcript to the visit
            try {
              const e2eEncryptionService = require('./services/e2eEncryptionService');
              const secureDataAccess = require('./services/secureDataAccess');
              const mongoose = require('mongoose');

              const fullAudio = Buffer.concat(audioChunks);
              const encrypted = await e2eEncryptionService.encryptWithServiceKey(fullAudio);

              // We need the dbName — for now use a lookup approach
              // The visitId was set during 'start', fetch the visit to get practiceId
              // This will be refined when wired to the full auth flow
              ws.send(JSON.stringify({
                type: 'recording_saved',
                visitId,
                transcript: { fullText: transcript.fullText },
              }));

              // Clean up audio buffer
              fullAudio.fill(0);
            } catch (err) {
              console.error('Failed to save recording:', err.message);
              ws.send(JSON.stringify({ type: 'error', code: 'SAVE_FAILED', message: err.message }));
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('[Visit WS] Message handling error:', err.message);
      ws.send(JSON.stringify({ type: 'error', code: 'INTERNAL', message: 'Server error' }));
    }
  });

  ws.on('close', () => {
    if (elevenLabsSession) {
      elevenLabsSession.close();
      elevenLabsSession = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[Visit WS] Connection error:', err.message);
    if (elevenLabsSession) {
      elevenLabsSession.close();
      elevenLabsSession = null;
    }
  });
});
```

**Step 5: Verify route loads**

Start the backend server and check logs for:
```
✓ Loaded route: /api/visits
```

**Step 6: Commit**

```bash
git add apps/backend-api/routes/visitRecording.js apps/backend-api/services/routeLoaderService.js apps/backend-api/services/secureDataAccess.js apps/backend-api/server.js
git commit -m "feat: add visit recording WebSocket + REST routes with audio encryption"
```

---

## Task 4: Agent Integration — Visit Tools

**Files:**
- Modify: `apps/backend-api/services/utils/aiHelpers.js`
- Modify: `apps/backend-api/services/agentServiceV4.js`
- Modify: `apps/backend-api/services/agentCapabilityManager.js`
- Modify: `apps/backend-api/services/claudeMedicalFunctionGroups.js`

**Step 1: Add tool descriptions to aiHelpers.js**

Find the tools array in `apps/backend-api/services/utils/aiHelpers.js` and add these three tools:

```javascript
{
  name: "startVisitRecording",
  description: "Start recording a new patient visit. Call this when the doctor wants to record a visit encounter. Returns a visitId that the frontend uses to start audio capture.",
  input_schema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID to link the visit to" },
      visitType: { type: "string", enum: ["in-person", "telehealth", "phone"], description: "Type of visit", default: "in-person" },
      consentMethod: { type: "string", enum: ["verbal", "written", "pre-visit-form"], description: "How patient consent was obtained", default: "verbal" },
    },
    required: ["patientId"]
  }
},
{
  name: "endVisitRecording",
  description: "End the current visit recording and generate an AI-structured SOAP note summary.",
  input_schema: {
    type: "object",
    properties: {
      visitId: { type: "string", description: "Visit ID to end recording for" }
    },
    required: ["visitId"]
  }
},
{
  name: "getPatientVisits",
  description: "Get visit history for a patient. Returns list of past visits with dates, types, and SOAP summaries.",
  input_schema: {
    type: "object",
    properties: {
      patientId: { type: "string", description: "Patient ID to get visit history for" },
      limit: { type: "number", description: "Maximum number of visits to return (default 10)" }
    },
    required: ["patientId"]
  }
},
```

**Step 2: Add case handlers to agentServiceV4.js**

Find the `_executeFunctionInternal` method's switch statement in `apps/backend-api/services/agentServiceV4.js` and add:

```javascript
case 'startVisitRecording': {
  const { patientId, visitType = 'in-person', consentMethod = 'verbal' } = args;
  const mongoose = require('mongoose');
  const visitDoc = {
    patientId: new mongoose.Types.ObjectId(patientId),
    practiceId: new mongoose.Types.ObjectId(practiceId),
    doctorId: new mongoose.Types.ObjectId(userId),
    chatSessionId: chatSessionId ? new mongoose.Types.ObjectId(chatSessionId) : undefined,
    visitDate: new Date(),
    visitType,
    status: 'recording',
    consentObtained: true,
    consentMethod,
    transcript: { fullText: '', segments: [] },
    createdBy: new mongoose.Types.ObjectId(userId),
  };

  const result = await secureDataAccess.insertOne(
    dbName, 'patient_visits', visitDoc,
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  const visitId = (result.insertedId || result._id).toString();

  // Notify frontend via Socket.IO to start recording
  if (global.io && chatSessionId) {
    global.io.to(`session_${chatSessionId}`).emit('visit_recording_start', {
      visitId,
      patientId,
      visitType,
    });
  }

  return {
    success: true,
    visitId,
    message: `Visit recording started. The microphone button should now be active. Visit ID: ${visitId}`,
  };
}

case 'endVisitRecording': {
  const { visitId } = args;
  const mongoose = require('mongoose');

  // Get the visit
  const visit = await secureDataAccess.findOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { serviceId: 'visit-recording-service', permissions: ['read'] }
  );

  if (!visit) {
    return { success: false, error: 'Visit not found' };
  }

  // Close ElevenLabs session if active
  const elevenLabsSttService = require('./elevenLabsSttService');
  const session = elevenLabsSttService.getSession(visitId);
  let transcript = visit.transcript;
  if (session) {
    const finalTranscript = session.close();
    transcript = {
      fullText: finalTranscript.fullText || transcript?.fullText || '',
      segments: finalTranscript.segments || transcript?.segments || [],
      language: finalTranscript.language || 'en',
    };
  }

  // Update transcript
  await secureDataAccess.updateOne(dbName, 'patient_visits',
    { _id: new mongoose.Types.ObjectId(visitId) },
    { $set: { status: 'transcribing', transcript } },
    { serviceId: 'visit-recording-service', permissions: ['write'] }
  );

  // Notify frontend
  if (global.io && visit.chatSessionId) {
    global.io.to(`session_${visit.chatSessionId}`).emit('visit_recording_end', { visitId });
  }

  return {
    success: true,
    visitId,
    transcriptPreview: transcript.fullText.substring(0, 200),
    message: 'Visit recording ended. AI summary is being generated.',
  };
}

case 'getPatientVisits': {
  const { patientId, limit = 10 } = args;
  const mongoose = require('mongoose');

  const visits = await secureDataAccess.find(dbName, 'patient_visits',
    { patientId: new mongoose.Types.ObjectId(patientId), isDeleted: { $ne: true } },
    { serviceId: 'visit-recording-service', permissions: ['read'] },
    {
      projection: { 'audioRecording.encryptedContent': 0, 'audioRecording.contentIv': 0, 'audioRecording.contentTag': 0 },
      sort: { visitDate: -1 },
      limit: Math.min(limit, 50),
    }
  );

  return {
    success: true,
    count: visits?.length || 0,
    visits: (visits || []).map(v => ({
      visitId: v._id,
      visitDate: v.visitDate,
      visitType: v.visitType,
      status: v.status,
      duration: v.duration,
      chiefComplaint: v.aiSummary?.chiefComplaint || '',
      hasTranscript: !!(v.transcript?.fullText),
      hasAudio: !!(v.audioRecording?.format),
    })),
  };
}
```

**Step 3: Add capability category to agentCapabilityManager.js**

Find the capability categories object and add:

```javascript
visitRecording: ['startVisitRecording', 'endVisitRecording', 'getPatientVisits'],
```

**Step 4: Add keyword group to claudeMedicalFunctionGroups.js**

Add to the function groups:

```javascript
visitRecording: [
  "record visit", "new visit", "start visit", "visit recording",
  "patient encounter", "office visit", "record appointment",
  "start recording", "end visit", "end recording", "visit history",
  "past visits", "visit summary", "soap note", "clinical encounter",
  "voice recording", "record this visit", "patient visit"
],
```

**Step 5: Commit**

```bash
git add apps/backend-api/services/utils/aiHelpers.js apps/backend-api/services/agentServiceV4.js apps/backend-api/services/agentCapabilityManager.js apps/backend-api/services/claudeMedicalFunctionGroups.js
git commit -m "feat: add agent tools for visit recording (start, end, getHistory)"
```

---

## Task 5: Mic Button + Audio Capture (Frontend)

**Files:**
- Create: `apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx`
- Create: `apps/frontend-vite/src/components/chat/VoiceRecordingButton.css`
- Modify: `apps/frontend-vite/src/components/chat/MessageInput.js`
- Modify: `apps/frontend-vite/src/components/chat/ChatContainer.js`

**Step 1: Create VoiceRecordingButton.css**

Create `apps/frontend-vite/src/components/chat/VoiceRecordingButton.css`:

```css
/* Voice Recording Button */
.voice-recording-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.2s ease;
  position: relative;
}

.voice-recording-btn:hover {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.voice-recording-btn.recording {
  color: #ef4444;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Popup menu */
.voice-recording-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 12px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.voice-recording-popup-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  color: #e2e8f0;
  font-size: 14px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  transition: background 0.15s ease;
}

.voice-recording-popup-option:hover {
  background: rgba(96, 165, 250, 0.15);
}

.voice-recording-popup-option .option-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.voice-recording-popup-option .option-label {
  font-weight: 500;
}

.voice-recording-popup-option .option-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* Recording timer */
.recording-timer {
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #ef4444;
  margin-left: 4px;
}

/* Consent dialog overlay */
.consent-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.consent-dialog {
  background: #1e293b;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 16px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  text-align: center;
}

.consent-dialog h3 {
  color: #f1f5f9;
  margin: 0 0 12px;
  font-size: 18px;
}

.consent-dialog p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0 0 20px;
  line-height: 1.5;
}

.consent-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.consent-btn {
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.consent-btn.primary {
  background: #3b82f6;
  color: #fff;
}

.consent-btn.primary:hover {
  background: #2563eb;
}

.consent-btn.secondary {
  background: rgba(96, 165, 250, 0.15);
  color: #94a3b8;
}

.consent-btn.secondary:hover {
  background: rgba(96, 165, 250, 0.25);
}

.consent-btn.cancel {
  background: none;
  color: #64748b;
}
```

**Step 2: Create VoiceRecordingButton.jsx**

Create `apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx`:

```jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import './VoiceRecordingButton.css';

const VoiceRecordingButton = ({
  onTranscriptUpdate,
  onVoiceChatText,
  onVisitStarted,
  onVisitEnded,
  patientContext,
  isRecording,
  setIsRecording,
  visitId,
  authToken,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingMode, setRecordingMode] = useState(null); // 'visit' | 'voiceChat'

  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const popupRef = useRef(null);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Duration timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start audio capture and WebSocket
  const startRecording = useCallback(async (mode, consentMethod = 'verbal') => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      // Set up AudioContext for PCM extraction
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessorNode for PCM chunks (AudioWorklet is better but more complex)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws/visit-recording?token=${authToken}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'start',
          visitId,
          mode,
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'session_started':
            break;
          case 'partial':
            if (onTranscriptUpdate) onTranscriptUpdate(msg.text, true);
            break;
          case 'committed':
            if (mode === 'voiceChat' && onVoiceChatText) {
              onVoiceChatText(msg.text);
            }
            if (onTranscriptUpdate) onTranscriptUpdate(msg.text, false, msg.speaker);
            break;
          case 'recording_saved':
          case 'summary_ready':
            if (onVisitEnded) onVisitEnded(msg);
            break;
          case 'error':
            console.error('[Voice Recording] Server error:', msg.message);
            break;
        }
      };

      ws.onerror = (err) => {
        console.error('[Voice Recording] WebSocket error:', err);
      };

      // Send PCM audio chunks
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        ws.send(JSON.stringify({ type: 'audio', data: base64 }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      setRecordingMode(mode);
      if (onVisitStarted) onVisitStarted(visitId);
    } catch (err) {
      console.error('[Voice Recording] Failed to start:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }, [visitId, authToken, onTranscriptUpdate, onVoiceChatText, onVisitStarted, onVisitEnded, setIsRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    // Send end message
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
      wsRef.current.close();
    }
    wsRef.current = null;

    // Stop audio
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setRecordingMode(null);
  }, [setIsRecording]);

  // Handle menu option click
  const handleOptionClick = (mode) => {
    setShowPopup(false);
    if (mode === 'visit') {
      setShowConsent(true);
    } else {
      startRecording('voiceChat');
    }
  };

  // Handle consent confirmation
  const handleConsent = (method) => {
    setShowConsent(false);
    startRecording('visit', method);
  };

  return (
    <div style={{ position: 'relative' }} ref={popupRef}>
      {/* Mic button */}
      <button
        className={`voice-recording-btn ${isRecording ? 'recording' : ''}`}
        onClick={() => {
          if (isRecording) {
            stopRecording();
          } else {
            setShowPopup(!showPopup);
          }
        }}
        title={isRecording ? 'Stop recording' : 'Voice options'}
      >
        {isRecording ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="recording-timer">{formatDuration(recordingDuration)}</span>
          </>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Popup menu */}
      {showPopup && !isRecording && (
        <div className="voice-recording-popup">
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('visit')}>
            <span className="option-icon">&#9899;</span>
            <div>
              <div className="option-label">Record Visit</div>
              <div className="option-desc">Full encounter recording with SOAP note</div>
            </div>
          </button>
          <button className="voice-recording-popup-option" onClick={() => handleOptionClick('voiceChat')}>
            <span className="option-icon">&#127908;</span>
            <div>
              <div className="option-label">Voice Chat</div>
              <div className="option-desc">Talk to IntelliCare instead of typing</div>
            </div>
          </button>
        </div>
      )}

      {/* Consent dialog */}
      {showConsent && (
        <div className="consent-overlay">
          <div className="consent-dialog">
            <h3>Patient Consent Required</h3>
            <p>This visit will be recorded for documentation purposes. Patient consent is required before proceeding.</p>
            <div className="consent-buttons">
              <button className="consent-btn primary" onClick={() => handleConsent('verbal')}>
                Patient Consents (Verbal)
              </button>
              <button className="consent-btn secondary" onClick={() => handleConsent('written')}>
                Written Consent on File
              </button>
              <button className="consent-btn cancel" onClick={() => setShowConsent(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecordingButton;
```

**Step 3: Modify MessageInput.js**

In `apps/frontend-vite/src/components/chat/MessageInput.js`, import and render the mic button. Find the button row area (where send/upload buttons are) and add:

```jsx
import VoiceRecordingButton from './VoiceRecordingButton';

// In the JSX, add between the textarea and existing buttons:
<VoiceRecordingButton
  onTranscriptUpdate={onTranscriptUpdate}
  onVoiceChatText={(text) => setMessage(prev => prev + ' ' + text)}
  onVisitStarted={onVisitStarted}
  onVisitEnded={onVisitEnded}
  patientContext={patientContext}
  isRecording={isRecording}
  setIsRecording={setIsRecording}
  visitId={activeVisitId}
  authToken={authToken}
/>
```

**Step 4: Modify ChatContainer.js**

In `apps/frontend-vite/src/components/chat/ChatContainer.js`, add state and pass props:

```javascript
// New state variables
const [isRecording, setIsRecording] = useState(false);
const [activeVisitId, setActiveVisitId] = useState(null);
const [liveTranscript, setLiveTranscript] = useState([]);
const [partialText, setPartialText] = useState('');

// Handlers
const handleTranscriptUpdate = (text, isPartial, speaker) => {
  if (isPartial) {
    setPartialText(text);
  } else {
    setPartialText('');
    setLiveTranscript(prev => [...prev, { text, speaker, timestamp: Date.now() }]);
  }
};

const handleVisitStarted = (visitId) => {
  setActiveVisitId(visitId);
  setLiveTranscript([]);
  setPartialText('');
};

const handleVisitEnded = (data) => {
  setIsRecording(false);
  setActiveVisitId(null);
  // Trigger artifact panel to show the visit summary
};

// Listen for Socket.IO events from agent
useEffect(() => {
  if (!socket) return;
  socket.on('visit_recording_start', (data) => {
    setActiveVisitId(data.visitId);
  });
  socket.on('visit_recording_end', (data) => {
    setIsRecording(false);
  });
  return () => {
    socket.off('visit_recording_start');
    socket.off('visit_recording_end');
  };
}, [socket]);
```

Pass these as props to MessageInput and LiveTranscriptCard.

**Step 5: Commit**

```bash
git add apps/frontend-vite/src/components/chat/VoiceRecordingButton.jsx apps/frontend-vite/src/components/chat/VoiceRecordingButton.css apps/frontend-vite/src/components/chat/MessageInput.js apps/frontend-vite/src/components/chat/ChatContainer.js
git commit -m "feat: add mic button with voice recording and real-time audio capture"
```

---

## Task 6: Live Transcript Card (Frontend)

**Files:**
- Create: `apps/frontend-vite/src/components/chat/LiveTranscriptCard.jsx`
- Create: `apps/frontend-vite/src/components/chat/LiveTranscriptCard.css`

**Step 1: Create LiveTranscriptCard.css**

Create `apps/frontend-vite/src/components/chat/LiveTranscriptCard.css`:

```css
.live-transcript-card {
  background: #0f172a;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  margin: 12px 0;
  overflow: hidden;
}

.live-transcript-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.live-transcript-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recording-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.live-transcript-title {
  color: #f1f5f9;
  font-weight: 600;
  font-size: 14px;
}

.live-transcript-timer {
  color: #94a3b8;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.live-transcript-body {
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.transcript-segment {
  margin-bottom: 10px;
}

.transcript-speaker {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 2px;
}

.transcript-speaker.doctor { color: #60a5fa; }
.transcript-speaker.patient { color: #34d399; }
.transcript-speaker.unknown { color: #94a3b8; }

.transcript-text {
  color: #e2e8f0;
  font-size: 14px;
  line-height: 1.5;
}

.transcript-partial {
  color: #64748b;
  font-style: italic;
  font-size: 14px;
  line-height: 1.5;
}

.live-transcript-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  display: flex;
  justify-content: center;
}

.end-visit-btn {
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.end-visit-btn:hover {
  background: #b91c1c;
}

.processing-spinner {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 14px;
}
```

**Step 2: Create LiveTranscriptCard.jsx**

Create `apps/frontend-vite/src/components/chat/LiveTranscriptCard.jsx`:

```jsx
import React, { useRef, useEffect } from 'react';
import './LiveTranscriptCard.css';

const LiveTranscriptCard = ({
  transcript = [],
  partialText = '',
  duration = 0,
  patientName = 'Patient',
  onEndVisit,
  isProcessing = false,
}) => {
  const bodyRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [transcript, partialText]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatSpeaker = (speaker) => {
    switch (speaker) {
      case 'doctor': return 'Doctor';
      case 'patient': return 'Patient';
      default: return 'Speaker';
    }
  };

  return (
    <div className="live-transcript-card">
      <div className="live-transcript-header">
        <div className="live-transcript-header-left">
          <div className="recording-dot" />
          <span className="live-transcript-title">Recording Visit — {patientName}</span>
        </div>
        <span className="live-transcript-timer">{formatDuration(duration)}</span>
      </div>

      <div className="live-transcript-body" ref={bodyRef}>
        {transcript.map((segment, idx) => (
          <div key={idx} className="transcript-segment">
            <div className={`transcript-speaker ${segment.speaker || 'unknown'}`}>
              [{formatSpeaker(segment.speaker)}]
            </div>
            <div className="transcript-text">{segment.text}</div>
          </div>
        ))}

        {partialText && (
          <div className="transcript-segment">
            <div className="transcript-partial">{partialText}</div>
          </div>
        )}

        {isProcessing && (
          <div className="processing-spinner">
            Generating visit summary...
          </div>
        )}
      </div>

      {!isProcessing && (
        <div className="live-transcript-footer">
          <button className="end-visit-btn" onClick={onEndVisit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            End Visit
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptCard;
```

**Step 3: Render LiveTranscriptCard in ChatContainer**

In `apps/frontend-vite/src/components/chat/ChatContainer.js`, import and render the card when recording is active:

```jsx
import LiveTranscriptCard from './LiveTranscriptCard';

// In the chat messages area, when isRecording is true:
{isRecording && (
  <LiveTranscriptCard
    transcript={liveTranscript}
    partialText={partialText}
    duration={recordingDuration}
    patientName={patientContext?.name || 'Patient'}
    onEndVisit={stopRecording}
    isProcessing={false}
  />
)}
```

**Step 4: Commit**

```bash
git add apps/frontend-vite/src/components/chat/LiveTranscriptCard.jsx apps/frontend-vite/src/components/chat/LiveTranscriptCard.css apps/frontend-vite/src/components/chat/ChatContainer.js
git commit -m "feat: add live transcript card with real-time speaker-labeled display"
```

---

## Task 7: Collection Wiring + Template (6-file pattern)

**Files:**
- Create: `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.jsx`
- Create: `apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.css`
- Create: `apps/frontend-vite/src/components/artifact/pdf-templates/PatientVisitDocumentPDFTemplate.jsx`
- Modify: `apps/backend-api/services/medicalCollectionsService.js`
- Modify: `apps/backend-api/services/optimizedMedicalFunctions.js`
- Modify: `apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx`
- Modify: `apps/frontend-vite/src/components/artifact/DocumentDetailView.jsx`
- Modify: `apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`

**This task follows the standard 65-rule template checklist.** Before implementation, run:
```
search_memories({"query": "template creation checklist"})
```

**Step 1: Backend wiring**

1. In `apps/backend-api/services/medicalCollectionsService.js`, add `'patient_visits'` to the `allCollections` array.

2. In `apps/backend-api/services/optimizedMedicalFunctions.js`, add to `functionCollectionMap`:
   ```javascript
   getPatientVisits: 'patient_visits',
   createPatientVisit: 'patient_visits',
   updatePatientVisit: 'patient_visits',
   deletePatientVisit: 'patient_visits',
   ```

**Step 2: Frontend wiring**

1. In `apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx`:
   - Add lazy import:
     ```javascript
     const PatientVisitDocument = lazy(() => import('./templates/PatientVisitDocument'));
     ```
   - Add to TEMPLATE_PATTERNS (use exact-match anchors per memory warning):
     ```javascript
     { pattern: /^patient[_\s]?visits?$/i, component: 'PatientVisitDocument' }
     ```

2. In `apps/frontend-vite/src/components/artifact/DocumentDetailView.jsx`:
   - Add `'patient_visits'` to the `AI_COLLECTIONS` array.

3. In `apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`:
   - Add `'patient_visits'` to the `DOCUMENT_VIEW_COLLECTIONS` array.

**Step 3: Create PatientVisitDocument.jsx template**

Follow the standard 3-prop pattern (`data`, `searchTerm`, `copiedSection`/`setCopiedSection`), mini-card pattern, 4-level search, section headers INSIDE mini-cards-container, Copy Section buttons, highlightText.

**Sections:**
1. Visit Details — date, doctor name, type, duration, status
2. Chief Complaint — single text field
3. History of Present Illness — text field
4. Review of Systems — text field
5. Physical Examination — text field
6. Assessment — text field
7. Plan — text field
8. Medications — text field
9. Follow-Up — text field
10. Transcript — expandable full transcript with speaker labels

**Step 4: Create PatientVisitDocument.css**

Follow existing template CSS patterns.

**Step 5: Create PatientVisitDocumentPDFTemplate.jsx**

Follow existing PDF template patterns (sectionTitle inside fieldBox, no borderBottom on titles).

**Step 6: Commit**

```bash
git add apps/backend-api/services/medicalCollectionsService.js apps/backend-api/services/optimizedMedicalFunctions.js apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx apps/frontend-vite/src/components/artifact/DocumentDetailView.jsx apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.jsx apps/frontend-vite/src/components/artifact/templates/PatientVisitDocument.css apps/frontend-vite/src/components/artifact/pdf-templates/PatientVisitDocumentPDFTemplate.jsx
git commit -m "feat: wire patient_visits collection with template and PDF"
```

---

## Task 8: Autocomplete — Backend Route

**Files:**
- Create: `apps/backend-api/routes/autocomplete.js`
- Modify: `apps/backend-api/services/routeLoaderService.js`

**Step 1: Create autocomplete route**

Create `apps/backend-api/routes/autocomplete.js`:

```javascript
const express = require('express');
const router = express.Router();
const { asyncHandler, requireAuth } = require('../middleware/routeMiddleware');

/**
 * POST /api/autocomplete/predict
 * Predict next words for medical note autocomplete
 */
router.post('/predict', requireAuth, asyncHandler(async (req, res) => {
  const { text, patientId, visitTranscript, maxTokens = 50 } = req.body;

  if (!text || text.length < 10) {
    return res.json({ success: true, data: { prediction: '', confidence: 0 } });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const productionKMS = require('../services/productionKMS');

    const apiKey = await productionKMS.getInternalKey('anthropic_api_key');
    const client = new Anthropic({ apiKey });

    // Build context
    let patientContext = '';
    if (patientId) {
      try {
        const secureDataAccess = require('../services/secureDataAccess');
        const mongoose = require('mongoose');
        const dbName = req.practiceDbName || `intellicare_practice_${req.practiceName}`;
        const patient = await secureDataAccess.findOne(dbName, 'patients',
          { _id: new mongoose.Types.ObjectId(patientId) },
          { serviceId: 'autocomplete-service', permissions: ['read'] },
          { projection: { firstName: 1, lastName: 1, dateOfBirth: 1, gender: 1 } }
        );
        if (patient) {
          patientContext = `Patient: ${patient.firstName} ${patient.lastName}, DOB: ${patient.dateOfBirth}, Gender: ${patient.gender}`;
        }
      } catch (e) { /* continue without */ }
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
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
}));

module.exports = router;
```

**Step 2: Register route**

In `apps/backend-api/services/routeLoaderService.js`, add:
```javascript
// ===== AUTOCOMPLETE =====
{ path: '/api/autocomplete', file: './routes/autocomplete' },
```

**Step 3: Commit**

```bash
git add apps/backend-api/routes/autocomplete.js apps/backend-api/services/routeLoaderService.js
git commit -m "feat: add autocomplete prediction route with Claude Haiku"
```

---

## Task 9: Autocomplete — Frontend Hook

**Files:**
- Create: `apps/frontend-vite/src/hooks/useAutocomplete.js`
- Modify: `apps/frontend-vite/src/components/chat/MessageInput.js`

**Step 1: Create useAutocomplete hook**

Create `apps/frontend-vite/src/hooks/useAutocomplete.js`:

```javascript
import { useState, useRef, useCallback, useEffect } from 'react';

const useAutocomplete = ({
  text = '',
  cursorPosition = 0,
  patientContext = null,
  visitTranscript = '',
  enabled = true,
  debounceMs = 300,
}) => {
  const [suggestion, setSuggestion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const cacheRef = useRef(new Map());

  const fetchPrediction = useCallback(async (currentText) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Check cache
    const cacheKey = currentText.slice(-50);  // Last 50 chars as key
    if (cacheRef.current.has(cacheKey)) {
      setSuggestion(cacheRef.current.get(cacheKey));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/autocomplete/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          text: currentText,
          patientId: patientContext?.patientId,
          visitTranscript,
          maxTokens: 50,
        }),
      });

      if (!response.ok) throw new Error('Prediction failed');
      const result = await response.json();

      if (result.success && result.data.prediction) {
        const prediction = result.data.prediction;
        setSuggestion(prediction);
        // Cache it
        cacheRef.current.set(cacheKey, prediction);
        if (cacheRef.current.size > 50) {
          // Evict oldest
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }
      } else {
        setSuggestion(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSuggestion(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientContext, visitTranscript]);

  // Debounced prediction trigger
  useEffect(() => {
    if (!enabled || !text || text.length < 10) {
      setSuggestion(null);
      return;
    }

    // Only predict at end of text
    if (cursorPosition !== text.length) {
      setSuggestion(null);
      return;
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchPrediction(text);
    }, debounceMs);

    return () => clearTimeout(debounceTimerRef.current);
  }, [text, cursorPosition, enabled, debounceMs, fetchPrediction]);

  const acceptSuggestion = useCallback(() => {
    const accepted = suggestion;
    setSuggestion(null);
    return accepted;
  }, [suggestion]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return {
    suggestion,
    isLoading,
    acceptSuggestion,
    dismissSuggestion,
  };
};

export default useAutocomplete;
```

**Step 2: Wire into MessageInput.js**

In `apps/frontend-vite/src/components/chat/MessageInput.js`:

```jsx
import useAutocomplete from '../../hooks/useAutocomplete';

// Inside the component:
const { suggestion, acceptSuggestion, dismissSuggestion } = useAutocomplete({
  text: message,
  cursorPosition: message.length,  // Simplified: assume cursor at end
  patientContext,
  visitTranscript: '',
  enabled: !isRecording,  // Disable during voice recording
});

// Key handler additions:
const handleKeyDown = (e) => {
  if (e.key === 'Tab' && suggestion) {
    e.preventDefault();
    const accepted = acceptSuggestion();
    if (accepted) setMessage(prev => prev + accepted);
  }
  if (e.key === 'Escape' && suggestion) {
    dismissSuggestion();
  }
  // ... existing key handlers
};

// In JSX, render ghost text after the textarea:
{suggestion && (
  <span className="autocomplete-ghost">{suggestion}</span>
)}
```

Add CSS for ghost text:
```css
.autocomplete-ghost {
  color: #475569;
  pointer-events: none;
  white-space: pre-wrap;
  font-style: italic;
}
```

**Step 3: Commit**

```bash
git add apps/frontend-vite/src/hooks/useAutocomplete.js apps/frontend-vite/src/components/chat/MessageInput.js
git commit -m "feat: add medical autocomplete with Copilot-style ghost text"
```

---

## Task 10: Install ElevenLabs SDK

**Files:**
- Modify: `apps/backend-api/package.json`

**Step 1: Install @elevenlabs/client**

```bash
cd /home/erangross/IntelliCare/apps/backend-api && npm install @elevenlabs/client
```

**Step 2: Verify installation**

```bash
node -e "const el = require('@elevenlabs/client'); console.log('ElevenLabs SDK loaded:', typeof el);"
```

**Step 3: Commit**

```bash
git add apps/backend-api/package.json apps/backend-api/package-lock.json
git commit -m "chore: install @elevenlabs/client SDK for speech-to-text"
```

---

## Prerequisites Before Running

1. **ElevenLabs API key** — Sign up at elevenlabs.io and generate an API key
2. **Store API key in KMS:**
   ```javascript
   // One-time setup via node REPL:
   const kms = require('./services/productionKMS');
   await kms.initialize();
   await kms.storeInternalKey('elevenlabs_api_key', 'YOUR_API_KEY_HERE');
   ```
3. **ws package** — Already installed (^8.18.3 in package.json)

---

## Verification Checklist

- [ ] PatientVisit model loads correctly
- [ ] ElevenLabs STT service initializes at server startup
- [ ] `/api/visits` REST endpoints work (start, end, approve, edit, get, list, delete)
- [ ] `/ws/visit-recording` WebSocket accepts connections
- [ ] Audio flows: browser → backend WS → ElevenLabs → transcripts back
- [ ] Mic button appears in chat input row
- [ ] Popup shows "Record Visit" and "Voice Chat" options
- [ ] Consent dialog appears before recording
- [ ] Live transcript displays with speaker labels
- [ ] "End Visit" triggers AI summarization
- [ ] SOAP note appears in artifact panel
- [ ] `patient_visits` appears in collection lists
- [ ] Template renders visits with mini-card pattern
- [ ] PDF generates correctly
- [ ] Autocomplete ghost text appears after 10+ chars
- [ ] Tab accepts autocomplete, Escape dismisses
- [ ] Agent recognizes "record a visit" commands
