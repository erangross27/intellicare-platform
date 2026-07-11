/**
 * Patient Search API — lightweight REST endpoint for voice-based patient lookup.
 * Used by VoiceRecordingButton to find a patient by spoken name before starting visit recording.
 */

const express = require('express');
const router = express.Router();
const { practiceContext } = require('../middleware/practiceContext');
const { fullClinicAuth } = require('../middleware/practiceAuth');
const patientService = require('../services/patientService');

router.use(practiceContext);
router.use(fullClinicAuth);

// GET /api/patients/search?name=John+Smith
router.get('/search', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name query required (min 2 characters)' });
    }

    await patientService.initialize();

    const practiceCtx = {
      subdomain: req.practice?.subdomain || req.practiceSubdomain,
      practiceId: req.practice?.id,
      language: 'en',
    };

    const result = await patientService.searchPatients(
      { query: name.trim() },
      practiceCtx,
      null
    );

    if (result.success && result.data && result.data.length > 0) {
      const patients = result.data.map(p => ({
        _id: p._id,
        firstName: p.firstName,
        lastName: p.lastName,
        name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        dateOfBirth: p.dateOfBirth,
      }));
      return res.json({ success: true, patients, count: patients.length });
    }

    return res.json({ success: true, patients: [], count: 0 });
  } catch (error) {
    console.error('[Patient Search] Error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

module.exports = router;
