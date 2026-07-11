/**
 * Patient Medicare Import Routes
 * For NEW PATIENT registration - patient logs into Medicare to import their data
 * This is NOT for practice staff login - this is for PATIENTS
 */

const express = require('express');
const router = express.Router();
const blueButtonOAuthService = require('../services/blueButtonOAuthService');
const SecureDataAccess = require('../services/secureDataAccess');

/**
 * Start patient Medicare import process
 * POST /api/patient-import/medicare/start
 * 
 * Called when practice staff wants patient to import their Medicare data
 */
router.post('/start', async (req, res) => {
  try {
    const { practiceId, staffUserId, sessionId } = req.body;
    
    // Generate a unique import session ID
    const importSessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store import session in database
    const context = {
      serviceId: 'patient-import-service',
      operation: 'startImport',
      practiceId: practiceId || req.practice?.id || 'global'
    };
    
    await SecureDataAccess.insert('patient_import_sessions', {
      importSessionId,
      practiceId,
      staffUserId,
      chatSessionId: sessionId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    }, context);
    
    // Generate OAuth URL for patient
    // Use a fixed callback URL so it works across all practice subdomains
    const redirectUri = process.env.BLUE_BUTTON_CALLBACK_URL
      || `https://${process.env.APP_HOST || req.get('host')}/api/patient-import/medicare/callback`;
    const { authUrl, state } = await blueButtonOAuthService.getAuthorizationUrl(
      redirectUri,
      importSessionId // Use import session as state
    );

    // Store authUrl in session so /go/:importSessionId redirect works
    await SecureDataAccess.update(
      'patient_import_sessions',
      { importSessionId },
      { $set: { authUrl } },
      context
    );
    
    res.json({
      success: true,
      importSessionId,
      authUrl,
      message: 'Patient can now log into Medicare to import their data'
    });
    
  } catch (error) {
    console.error('Start patient import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start patient import process',
      error: error.message
    });
  }
});

/**
 * Serve QR code as PNG image
 * GET /api/patient-import/medicare/qr/:importSessionId
 */
router.get('/qr/:importSessionId', async (req, res) => {
  try {
    const { importSessionId } = req.params;

    const context = {
      serviceId: 'patient-import-service',
      operation: 'qrCode',
      practiceId: 'global'
    };

    const sessions = await SecureDataAccess.query('patient_import_sessions', {
      importSessionId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }, { limit: 1 }, context);

    if (!sessions || sessions.length === 0) {
      return res.status(410).send('Link expired');
    }

    const QRCode = require('qrcode');
    const host = process.env.APP_HOST || req.get('host');
    const protocol = req.protocol === 'http' ? 'https' : req.protocol;
    const shortUrl = `${protocol}://${host}/api/patient-import/medicare/go/${importSessionId}`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    await QRCode.toFileStream(res, shortUrl, { width: 300, margin: 2 });
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).send('Failed to generate QR code');
  }
});

/**
 * Short redirect — patient clicks this clean URL, gets redirected to CMS
 * GET /api/patient-import/medicare/go/:importSessionId
 */
router.get('/go/:importSessionId', async (req, res) => {
  try {
    const { importSessionId } = req.params;

    const context = {
      serviceId: 'patient-import-service',
      operation: 'redirect',
      practiceId: 'global'
    };

    const sessions = await SecureDataAccess.query('patient_import_sessions', {
      importSessionId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }, { limit: 1 }, context);

    if (!sessions || sessions.length === 0) {
      return res.status(410).send(`
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #1a1b26; color: #ececf1;">
            <h2>Link Expired</h2>
            <p>This Medicare import link has expired. Please ask staff to generate a new one.</p>
          </body>
        </html>
      `);
    }

    const authUrl = sessions[0].authUrl;
    if (!authUrl) {
      return res.status(500).send('Authorization URL not found');
    }

    res.redirect(authUrl);
  } catch (error) {
    console.error('Medicare redirect error:', error);
    res.status(500).send('Failed to redirect to Medicare');
  }
});

/**
 * Handle Medicare OAuth callback for patient import
 * GET /api/patient-import/medicare/callback
 *
 * Medicare redirects here after PATIENT logs in
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state: importSessionId, error } = req.query;
    
    // Check for errors
    if (error) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: red;">❌ Medicare Login Failed</h2>
            <p>${error === 'access_denied' ? 'You declined to share your Medicare information' : 'An error occurred'}</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Close Window</button>
          </body>
        </html>
      `);
    }
    
    // Get import session
    const context = {
      serviceId: 'patient-import-service',
      operation: 'callback',
      practiceId: 'global'
    };
    
    const sessions = await SecureDataAccess.query('patient_import_sessions', {
      importSessionId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }, { limit: 1 }, context);
    
    if (!sessions || sessions.length === 0) {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2 style="color: red;">❌ Session Expired</h2>
            <p>Please ask staff to start a new import session</p>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Close Window</button>
          </body>
        </html>
      `);
    }
    
    const importSession = sessions[0];
    // Must match the URL registered with CMS and used in /start
    const redirectUri = process.env.BLUE_BUTTON_CALLBACK_URL
      || `https://${process.env.APP_HOST || req.get('host')}/api/patient-import/medicare/callback`;
    
    // Exchange code for access token
    const result = await blueButtonOAuthService.exchangeCodeForToken(code, redirectUri, importSessionId);

    // Get patient data immediately using the raw access token from exchange
    const patientId = result.patientId;
    const accessToken = result.accessToken;
    console.log('🔵 Callback - patientId:', patientId, 'hasToken:', !!accessToken, 'tokenLen:', accessToken?.length);

    if (accessToken) {

      // Step 1: Get demographics first to discover FHIR patient ID
      const demographics = await blueButtonOAuthService.getPatientDemographics(accessToken, patientId);
      const fhirPatientId = demographics?.id || patientId;
      console.log('🔵 Discovered FHIR patient ID:', fhirPatientId);

      // Step 2: Use real FHIR patient ID for coverage and claims
      const [coverage, claims] = await Promise.all([
        blueButtonOAuthService.getCoverage(accessToken, fhirPatientId),
        blueButtonOAuthService.getClaims(accessToken, fhirPatientId, 20)
      ]);
      
      // Store imported data
      await SecureDataAccess.update(
        'patient_import_sessions',
        { importSessionId },
        {
          $set: {
            status: 'completed',
            patientData: {
              // Demographics
              firstName: demographics.name?.given?.[0] || '',
              lastName: demographics.name?.family || '',
              middleName: demographics.name?.given?.[1] || '',
              dateOfBirth: demographics.birthDate,
              gender: demographics.gender,
              mbi: demographics.mbi,
              
              // Address
              street: demographics.address?.line?.join(' ') || '',
              city: demographics.address?.city || '',
              state: demographics.address?.state || '',
              zipCode: demographics.address?.postalCode || '',
              
              // Contact
              phone: demographics.telecom?.find(t => t.system === 'phone')?.value || '',
              email: demographics.telecom?.find(t => t.system === 'email')?.value || '',
              
              // Race/Ethnicity
              race: demographics.race,
              ethnicity: demographics.ethnicity,
              
              // Insurance
              insuranceProvider: 'Medicare',
              medicarePartA: coverage.some(c => c.type?.includes('Part A')),
              medicarePartB: coverage.some(c => c.type?.includes('Part B')),
              medicarePartD: coverage.find(c => c.type?.includes('Part D'))?.payor,
              medicareAdvantage: coverage.find(c => c.type?.includes('Part C'))?.payor,
              
              // Medical History
              diagnoses: [...new Set(claims.flatMap(c => c.diagnosis || [])
                .filter(d => d.code)
                .map(d => ({
                  code: d.code,
                  description: d.display,
                  firstSeen: claims.find(cl => cl.diagnosis?.some(di => di.code === d.code))?.created
                })))],
              
              procedures: [...new Set(claims.flatMap(c => c.procedure || [])
                .filter(p => p.code)
                .map(p => ({
                  code: p.code,
                  description: p.display,
                  date: p.date
                })))],
              
              providers: [...new Set(claims.map(c => c.provider).filter(Boolean))],
              
              // Summary stats
              totalClaims: claims.length,
              lastClaimDate: claims[0]?.created
            },
            completedAt: new Date()
          }
        },
        context
      );
      
      // Show success page to patient
      return res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
              }
              .container {
                background: white;
                color: #333;
                padding: 40px;
                border-radius: 20px;
                max-width: 500px;
                margin: 0 auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              }
              .success-icon {
                font-size: 72px;
                color: #48bb78;
                margin-bottom: 20px;
              }
              h2 {
                color: #2d3748;
                margin-bottom: 10px;
              }
              .patient-name {
                font-size: 24px;
                font-weight: bold;
                color: #5a67d8;
                margin: 20px 0;
              }
              .info-box {
                background: #f7fafc;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: left;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e2e8f0;
              }
              .info-row:last-child {
                border-bottom: none;
              }
              .label {
                font-weight: 600;
                color: #4a5568;
              }
              .value {
                color: #2d3748;
              }
              button {
                background: #5a67d8;
                color: white;
                border: none;
                padding: 15px 40px;
                font-size: 18px;
                border-radius: 10px;
                cursor: pointer;
                margin-top: 20px;
              }
              button:hover {
                background: #4c51bf;
              }
              .instructions {
                margin-top: 30px;
                padding: 20px;
                background: #edf2f7;
                border-radius: 10px;
                color: #4a5568;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h2>Medicare Information Imported Successfully!</h2>
              
              <div class="patient-name">
                ${demographics.name?.given?.[0]} ${demographics.name?.family}
              </div>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Medicare ID:</span>
                  <span class="value">${demographics.mbi || 'Not available'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Date of Birth:</span>
                  <span class="value">${demographics.birthDate}</span>
                </div>
                <div class="info-row">
                  <span class="label">Coverage:</span>
                  <span class="value">Parts ${coverage.map(c => c.type?.replace('Medicare ', '')).filter(Boolean).join(', ') || 'A, B'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Medical Records:</span>
                  <span class="value">${claims.length} claims imported</span>
                </div>
                <div class="info-row">
                  <span class="label">Diagnoses Found:</span>
                  <span class="value">${[...new Set(claims.flatMap(c => c.diagnosis || []).map(d => d.code))].length}</span>
                </div>
              </div>
              
              <div class="instructions">
                <strong>Next Steps:</strong><br>
                Please return the tablet to the staff member.<br>
                They will complete your registration.
              </div>
              
              <button onclick="window.close()">Done - Close Window</button>
            </div>
            
            <script>
              // Notify parent window (if in iframe or popup)
              if (window.opener) {
                window.opener.postMessage({
                  type: 'medicare-import-complete',
                  importSessionId: '${importSessionId}',
                  patientName: '${demographics.name?.given?.[0]} ${demographics.name?.family}'
                }, '*');
              }
              
              // Auto-close after 30 seconds
              setTimeout(() => {
                if (window.opener) {
                  window.close();
                }
              }, 30000);
            </script>
          </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('Patient import callback error:', error);
    return res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: red;">❌ Import Failed</h2>
          <p>An error occurred while importing your Medicare information</p>
          <p style="color: #666; font-size: 14px;">${error.message}</p>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px;">Close Window</button>
        </body>
      </html>
    `);
  }
});

/**
 * Check import session status
 * GET /api/patient-import/medicare/status/:importSessionId
 * 
 * Staff can poll this to check if patient completed import
 */
router.get('/status/:importSessionId', async (req, res) => {
  try {
    const { importSessionId } = req.params;
    
    const context = {
      serviceId: 'patient-import-service',
      operation: 'checkStatus',
      practiceId: req.practice?.id || 'global'
    };
    
    const sessions = await SecureDataAccess.query('patient_import_sessions', {
      importSessionId
    }, { limit: 1 }, context);
    
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }
    
    const session = sessions[0];
    
    res.json({
      success: true,
      status: session.status,
      completed: session.status === 'completed',
      patientData: session.status === 'completed' ? session.patientData : null,
      createdAt: session.createdAt,
      completedAt: session.completedAt
    });
    
  } catch (error) {
    console.error('Check import status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check import status',
      error: error.message
    });
  }
});

module.exports = router;