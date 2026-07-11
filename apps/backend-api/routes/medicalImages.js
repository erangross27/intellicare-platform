/**
 * Medical Image Analysis Routes
 * Endpoints for analyzing medical images via Claude Vision API
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const SecureSessionManager = require('../services/secureSessionManager');
const databaseFactory = require('../utils/databaseFactory');

// Image upload config — memory storage, max 50MB, images + DICOM only
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') ||
                    file.mimetype === 'application/dicom' ||
                    file.originalname?.endsWith('.dcm');
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG) and DICOM (.dcm) files are allowed'), false);
    }
  }
});

// ─── Auth Helper ────────────────────────────────────────────────────

async function authenticateRequest(req, res) {
  const sessionToken = req.cookies?.sessionToken;
  if (!sessionToken) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return null;
  }

  const session = await SecureSessionManager.validateSession(sessionToken);
  if (!session) {
    res.status(401).json({ success: false, message: 'Session expired or invalid' });
    return null;
  }

  const practiceSubdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
  if (!practiceSubdomain) {
    res.status(400).json({ success: false, message: 'Practice context required' });
    return null;
  }

  return {
    userId: String(session.userId),
    practiceSubdomain,
    practiceId: session.practiceId
  };
}

// ─── POST /analyze — Single Image Analysis ─────────────────────────

router.post('/analyze', imageUpload.single('image'), async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const { patientId, modality, bodyPart, clinicalHistory } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const claudeMedicalImageService = require('../services/claudeMedicalImageService');

    let imageBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    let dicomMetadata = null;

    // Handle DICOM files
    if (mimeType === 'application/dicom' || req.file.originalname?.endsWith('.dcm')) {
      try {
        const dicomConverterService = require('../services/dicomConverterService');
        const dicomResult = await dicomConverterService.processForAnalysis(req.file.buffer);
        imageBuffer = dicomResult.imageBuffer;
        mimeType = dicomResult.mimeType;
        dicomMetadata = dicomResult.metadata;
      } catch (dicomErr) {
        return res.status(400).json({
          success: false,
          error: 'Failed to process DICOM file',
          details: dicomErr.message
        });
      }
    }

    const result = await claudeMedicalImageService.analyzeImage(imageBuffer, mimeType, {
      modality: modality || undefined,
      bodyPart: bodyPart || undefined,
      clinicalHistory: clinicalHistory || undefined,
      patientId,
      practiceId: auth.practiceId,
      dicomMetadata
    });

    res.json({
      success: true,
      analysis: result,
      dicomMetadata: dicomMetadata || undefined
    });
  } catch (error) {
    console.error('❌ Medical image analysis error:', error.message);
    res.status(500).json({ success: false, error: 'Image analysis failed', details: error.message });
  }
});

// ─── POST /compare — Two-Image Comparison ──────────────────────────

router.post('/compare', imageUpload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]), async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const image1 = req.files?.image1?.[0];
    const image2 = req.files?.image2?.[0];

    if (!image1 || !image2) {
      return res.status(400).json({ success: false, error: 'Two images required (image1, image2)' });
    }

    const { modality, clinicalHistory, patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const claudeMedicalImageService = require('../services/claudeMedicalImageService');

    const result = await claudeMedicalImageService.compareImages(
      image1.buffer, image1.mimetype,
      image2.buffer, image2.mimetype,
      {
        modality: modality || undefined,
        clinicalHistory: clinicalHistory || undefined,
        patientId,
        practiceId: auth.practiceId
      }
    );

    res.json({ success: true, comparison: result });
  } catch (error) {
    console.error('❌ Image comparison error:', error.message);
    res.status(500).json({ success: false, error: 'Image comparison failed', details: error.message });
  }
});

// ─── POST /study — Multi-Image Study Analysis ──────────────────────

router.post('/study', imageUpload.array('images', 20), async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image is required' });
    }

    const { modality, clinicalHistory, patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const claudeMedicalImageService = require('../services/claudeMedicalImageService');

    const images = req.files.map(f => ({
      buffer: f.buffer,
      mimeType: f.mimetype
    }));

    const result = await claudeMedicalImageService.analyzeStudy(images, {
      modality: modality || undefined,
      clinicalHistory: clinicalHistory || undefined,
      patientId,
      practiceId: auth.practiceId
    });

    res.json({ success: true, study: result });
  } catch (error) {
    console.error('❌ Study analysis error:', error.message);
    res.status(500).json({ success: false, error: 'Study analysis failed', details: error.message });
  }
});

// ─── GET /:patientId — Patient Imaging History ─────────────────────

router.get('/:patientId', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { patientId } = req.params;
    const { modality, limit } = req.query;

    const claudeMedicalImageService = require('../services/claudeMedicalImageService');

    const history = await claudeMedicalImageService.getPatientImagingHistory(
      patientId,
      auth.practiceId,
      {
        modality: modality || undefined,
        limit: limit ? parseInt(limit) : 50
      }
    );

    res.json({ success: true, results: history });
  } catch (error) {
    console.error('❌ Imaging history error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch imaging history', details: error.message });
  }
});

module.exports = router;
