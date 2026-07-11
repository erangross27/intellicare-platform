/**
 * Visit Recording Routes
 * REST endpoints for patient visit CRUD (recording, AI summarization, approval, editing)
 * WebSocket handler lives in server.js
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');

// Lazy-loaded services to avoid circular dependencies
let secureDataAccess;
function getSecureDataAccess() {
  if (!secureDataAccess) secureDataAccess = require('../services/secureDataAccess');
  return secureDataAccess;
}

let e2eEncryptionService;
function getE2EEncryptionService() {
  if (!e2eEncryptionService) e2eEncryptionService = require('../services/e2eEncryptionService');
  return e2eEncryptionService;
}

let productionKMS;
function getProductionKMS() {
  if (!productionKMS) productionKMS = require('../services/productionKMS');
  return productionKMS;
}

// Apply middleware: context → models → auth
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(req, operation = 'read') {
  return {
    serviceId: 'visit-recording-service',
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

/**
 * Generate AI SOAP summary using Claude Sonnet 5
 * @param {string} transcriptText - Full transcript text
 * @returns {Promise<Object>} Structured SOAP note fields
 */
async function generateAISummary(transcriptText) {
  const Anthropic = require('@anthropic-ai/sdk');
  const kms = getProductionKMS();

  if (!kms.initialized) {
    await kms.initialize();
  }
  const apiKey = await kms.getInternalKey('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Anthropic API key not available');

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a clinical documentation assistant. Given a doctor-patient visit transcript,
extract structured SOAP note information. Return ONLY valid JSON with these fields:
- chiefComplaint: main complaint in 1-2 sentences
- historyOfPresentIllness: detailed HPI
- reviewOfSystems: relevant ROS findings
- physicalExamination: exam findings if mentioned
- assessment: clinical assessment and diagnoses
- plan: treatment plan
- medications: medications mentioned or prescribed
- followUp: follow-up instructions`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Please extract a structured SOAP note from this visit transcript:\n\n${transcriptText}`,
      },
    ],
  });

  const content = response.content[0]?.text || '{}';

  // Strip markdown code fences if present
  const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { plan: content };
  }

  return {
    chiefComplaint: parsed.chiefComplaint || '',
    historyOfPresentIllness: parsed.historyOfPresentIllness || '',
    reviewOfSystems: parsed.reviewOfSystems || '',
    physicalExamination: parsed.physicalExamination || '',
    assessment: parsed.assessment || '',
    plan: parsed.plan || '',
    medications: parsed.medications || '',
    followUp: parsed.followUp || '',
    modelUsed: 'claude-sonnet-5',
    generatedAt: new Date(),
  };
}

// ─── POST /api/visits/start — Create visit with status "recording" ─────────────

router.post('/start', async (req, res) => {
  try {
    const {
      patientId,
      visitType = 'in-person',
      consentObtained = false,
      consentMethod,
      chatSessionId,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    const doc = {
      patientId: toObjectId(patientId) || patientId,
      practiceId: toObjectId(req.practiceContext?.practiceId) || req.practiceContext?.practiceId,
      doctorId: toObjectId(req.user?.id) || req.user?.id,
      chatSessionId: chatSessionId ? (toObjectId(chatSessionId) || chatSessionId) : undefined,
      visitDate: new Date(),
      visitType,
      status: 'recording',
      consentObtained,
      consentMethod: consentMethod || undefined,
      createdBy: toObjectId(req.user?.id) || req.user?.id,
      isDeleted: false,
    };

    const result = await sda.insert('patient_visits', doc, context);
    const visitId = result.insertedId?.toString() || result._id?.toString();

    return res.status(201).json({ success: true, visitId, visit: doc });
  } catch (err) {
    console.error('[Visit] POST /start error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/visits/:id/end — End recording, trigger AI summarization ───────

router.post('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript, audioBase64, duration } = req.body;

    const oidFilter = { _id: toObjectId(id) };
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Encrypt audio if provided
    let audioRecording;
    if (audioBase64) {
      const enc = getE2EEncryptionService();
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const encrypted = await enc.encryptWithServiceKey(audioBuffer);
      audioRecording = {
        encryptedContent: Buffer.from(encrypted.data, 'base64'),
        contentIv: encrypted.iv,
        contentTag: encrypted.tag,
        format: 'webm/opus',
        sampleRate: 16000,
        fileSize: audioBuffer.length,
        duration: duration || 0,
      };
    }

    // Update status to transcribing first
    const updatePayload = {
      $set: {
        status: 'transcribing',
        transcript: transcript || { fullText: '', segments: [] },
        ...(audioRecording ? { audioRecording } : {}),
        ...(duration !== undefined ? { duration } : {}),
      },
    };

    await sda.update('patient_visits', oidFilter, updatePayload, context);

    // Generate AI summary if we have transcript text
    const fullText = transcript?.fullText || '';
    let aiSummary = null;

    if (fullText.trim().length > 0) {
      try {
        aiSummary = await generateAISummary(fullText);
      } catch (aiErr) {
        console.warn('[Visit] AI summarization failed:', aiErr.message);
      }
    }

    // Update with AI summary and set status to "reviewing"
    const summaryPayload = {
      $set: {
        status: 'reviewing',
        ...(aiSummary ? { aiSummary } : {}),
      },
    };

    await sda.update('patient_visits', oidFilter, summaryPayload, context);

    return res.json({ success: true, visitId: id, aiSummary });
  } catch (err) {
    console.error('[Visit] POST /:id/end error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/visits/:id/approve — Doctor approves visit note ─────────────────

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update(
      'patient_visits',
      { _id: toObjectId(id) },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: toObjectId(req.user?.id) || req.user?.id,
        },
      },
      context,
    );

    return res.json({ success: true, visitId: id, status: 'approved' });
  } catch (err) {
    console.error('[Visit] PUT /:id/approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/visits/:id/edit — Doctor edits AI summary fields ────────────────

router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { edits } = req.body; // Object with aiSummary fields to update

    if (!edits || typeof edits !== 'object') {
      return res.status(400).json({ success: false, error: 'edits object is required' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Build partial update for aiSummary fields
    const setFields = {};
    const allowedFields = [
      'chiefComplaint',
      'historyOfPresentIllness',
      'reviewOfSystems',
      'physicalExamination',
      'assessment',
      'plan',
      'medications',
      'followUp',
    ];

    const editedFieldNames = [];
    for (const field of allowedFields) {
      if (edits[field] !== undefined) {
        setFields[`aiSummary.${field}`] = edits[field];
        editedFieldNames.push(field);
      }
    }

    if (editedFieldNames.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid aiSummary fields provided' });
    }

    setFields['doctorEdits.editedFields'] = editedFieldNames;
    setFields['doctorEdits.editedAt'] = new Date();
    setFields['status'] = 'amended';

    await sda.update('patient_visits', { _id: toObjectId(id) }, { $set: setFields }, context);

    return res.json({ success: true, visitId: id, editedFields: editedFieldNames });
  } catch (err) {
    console.error('[Visit] PUT /:id/edit error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/visits/:id/process-text — AI structures free-form text into SOAP ─
// Doctor types raw visit notes → Claude structures into SOAP fields

router.post('/:id/process-text', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Visit text is required' });
    }

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    // Generate structured SOAP note from free-form text
    console.log(`[Visit] Processing free-form text for visit ${id} (${text.length} chars)`);
    const aiSummary = await generateAISummary(text);

    // Save SOAP fields + original text as transcript
    await sda.update(
      'patient_visits',
      { _id: toObjectId(id) },
      {
        $set: {
          'aiSummary': aiSummary,
          'transcript.fullText': text,
          'status': 'reviewing',
        },
      },
      context,
    );

    console.log(`[Visit] SOAP note generated for visit ${id}`);
    return res.json({ success: true, visitId: id, aiSummary });
  } catch (err) {
    console.error('[Visit] POST /:id/process-text error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/visits/patient/:pid — Get visit history for patient ──────────────
// NOTE: Must be before /:id to avoid route shadowing

router.get('/patient/:pid', async (req, res) => {
  try {
    const { pid } = req.params;
    const { limit = 20 } = req.query;

    const sda = getSecureDataAccess();
    const context = buildContext(req, 'read');

    const visits = await sda.query(
      'patient_visits',
      {
        patientId: toObjectId(pid) || pid,
        isDeleted: { $ne: true },
      },
      {
        limit: parseInt(limit, 10),
        sort: { visitDate: -1 },
        projection: { 'audioRecording.encryptedContent': 0, 'audioRecording.contentIv': 0, 'audioRecording.contentTag': 0 },
      },
      context,
    );

    return res.json({ success: true, visits });
  } catch (err) {
    console.error('[Visit] GET /patient/:pid error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/visits/:id — Get single visit (NO audio binary) ────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'read');

    const results = await sda.query(
      'patient_visits',
      { _id: toObjectId(id), isDeleted: { $ne: true } },
      {
        limit: 1,
        projection: { 'audioRecording.encryptedContent': 0, 'audioRecording.contentIv': 0, 'audioRecording.contentTag': 0 },
      },
      context,
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }

    return res.json({ success: true, visit: results[0] });
  } catch (err) {
    console.error('[Visit] GET /:id error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/visits/:id/audio — Stream decrypted audio for playback ──────────

router.get('/:id/audio', async (req, res) => {
  try {
    const { id } = req.params;
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'read');

    const results = await sda.query(
      'patient_visits',
      { _id: toObjectId(id), isDeleted: { $ne: true } },
      { limit: 1 },
      context,
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }

    const visit = results[0];

    if (!visit.audioRecording?.encryptedContent) {
      return res.status(404).json({ success: false, error: 'No audio recording for this visit' });
    }

    const enc = getE2EEncryptionService();
    const { encryptedContent, contentIv, contentTag } = visit.audioRecording;

    // encryptedContent is stored as Buffer; build encrypted package for decryption
    const encryptedPackage = {
      data: Buffer.isBuffer(encryptedContent)
        ? encryptedContent.toString('base64')
        : encryptedContent,
      iv: contentIv,
      tag: contentTag,
      algorithm: 'aes-256-gcm',
    };

    const decrypted = await enc.decryptWithServiceKey(encryptedPackage);
    const audioBuffer = decrypted.data;

    const format = visit.audioRecording.format || 'webm/opus';
    const mimeType = format.startsWith('webm') ? 'audio/webm' : 'audio/ogg';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="visit-${id}.webm"`);
    res.setHeader('Accept-Ranges', 'bytes');

    return res.send(audioBuffer);
  } catch (err) {
    console.error('[Visit] GET /:id/audio error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/visits/:id — Soft-delete ────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sda = getSecureDataAccess();
    const context = buildContext(req, 'write');

    await sda.update(
      'patient_visits',
      { _id: toObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
      context,
    );

    return res.json({ success: true, visitId: id, deleted: true });
  } catch (err) {
    console.error('[Visit] DELETE /:id error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
