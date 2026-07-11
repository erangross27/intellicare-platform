/**
 * Claude Medical Image Analysis Service
 * Uses Claude Vision API (claude-sonnet-5) for medical image interpretation
 *
 * Supports: X-ray, CT, MRI, Ultrasound, Mammogram, PET, Nuclear Medicine
 * Output: Structured radiology reports with technique, findings, impression, recommendations
 */

const Anthropic = require('@anthropic-ai/sdk');
const productionKMS = require('./productionKMS');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class ClaudeMedicalImageService {
  constructor() {
    this.serviceId = 'claude-medical-image-service';
    this.serviceToken = null;
    this.initialized = false;
    this.claude = null;
    this.modelId = 'claude-sonnet-5';
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Get API key from KMS
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      const apiKey = await productionKMS.getInternalKey('CLAUDE_API_KEY') ||
                     await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error('No Claude/Anthropic API key found in KMS');
      }

      this.claude = new Anthropic({ apiKey });

      // Authenticate service account for SecureDataAccess DB operations
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);

      this.initialized = true;
      console.log(`✅ ${this.serviceId} initialized (model: ${this.modelId})`);
    } catch (error) {
      console.error(`❌ ${this.serviceId} initialization failed:`, error.message);
      throw error;
    }
  }

  // ─── Modality-Specific Prompts ────────────────────────────────────

  getModalityPrompt(modality) {
    const prompts = {
      xray: `You are a board-certified radiologist interpreting a plain radiograph (X-ray).
Provide a systematic analysis following ACR reporting guidelines:
- Identify the projection (AP, PA, lateral, oblique) and body region
- Assess bone structures, soft tissues, and relevant anatomy
- Note alignment, joint spaces, fractures, dislocations
- Evaluate cardiomediastinal silhouette if chest X-ray
- Check for pneumothorax, pleural effusions, consolidation if applicable
- Report any foreign bodies, lines, tubes, or hardware`,

      ct: `You are a board-certified radiologist interpreting a CT scan.
Provide a systematic analysis:
- Identify the body region and whether contrast was administered
- Use a structured organ-by-organ approach
- Report measurements of any lesions or abnormalities in mm/cm
- Evaluate vascular structures, lymph nodes
- Assess for acute findings (hemorrhage, perforation, dissection)
- Note incidental findings with follow-up recommendations
- Reference appropriate ACR Incidental Findings guidelines`,

      mri: `You are a board-certified radiologist interpreting an MRI study.
Provide a systematic analysis:
- Identify sequences shown and body region
- Report signal characteristics (T1, T2, FLAIR, DWI, enhancement patterns)
- Provide measurements of any lesions
- Assess for edema, mass effect, herniation if brain/spine
- Evaluate ligaments, cartilage, menisci if musculoskeletal
- Note any artifacts affecting diagnostic quality`,

      ultrasound: `You are a board-certified radiologist interpreting an ultrasound study.
Provide a systematic analysis:
- Identify the body region and exam type (diagnostic, Doppler, focused)
- Describe echogenicity of structures (hyperechoic, hypoechoic, anechoic)
- Report measurements of organs and any lesions
- Evaluate blood flow patterns if Doppler is shown
- Note any collections, masses, or structural abnormalities
- Apply TI-RADS scoring if thyroid, BI-RADS if breast`,

      mammogram: `You are a board-certified radiologist specializing in breast imaging.
Provide analysis following BI-RADS reporting guidelines:
- Identify the view (CC, MLO) and breast composition category (a-d)
- Describe any masses (shape, margin, density)
- Describe any calcifications (morphology, distribution)
- Note architectural distortion or asymmetries
- Assess axillary lymph nodes if visible
- Assign a BI-RADS category (0-6) with management recommendation
- Compare with prior studies if mentioned`,

      pet: `You are a board-certified nuclear medicine physician interpreting a PET scan.
Provide a systematic analysis:
- Report SUV values for areas of uptake
- Distinguish physiologic from pathologic uptake
- Evaluate primary lesion, regional lymph nodes, distant sites
- Apply relevant staging criteria
- Note any incidental findings`,

      general: `You are a board-certified radiologist with expertise in all imaging modalities.
Provide a thorough medical image analysis:
- Identify the imaging modality and body region
- Provide systematic findings using standard radiology reporting format
- Report all abnormalities with measurements where possible
- Provide differential diagnoses ranked by likelihood
- Include recommendations for follow-up or additional imaging`
    };

    return prompts[modality] || prompts.general;
  }

  detectModality(mimeType, metadata = {}) {
    if (metadata.modality) {
      const mod = metadata.modality.toLowerCase();
      if (mod.includes('cr') || mod.includes('dx') || mod.includes('xr')) return 'xray';
      if (mod.includes('ct')) return 'ct';
      if (mod.includes('mr')) return 'mri';
      if (mod.includes('us')) return 'ultrasound';
      if (mod.includes('mg') || mod.includes('mammo')) return 'mammogram';
      if (mod.includes('pt') || mod.includes('pet')) return 'pet';
    }
    // Default to general if we can't determine modality
    return 'general';
  }

  // ─── Core Analysis Methods ────────────────────────────────────────

  /**
   * Analyze a single medical image
   * @param {Buffer} imageBuffer - Image data
   * @param {string} mimeType - Image MIME type (image/jpeg, image/png)
   * @param {Object} options - { modality, bodyPart, clinicalHistory, patientId, practiceId, dicomMetadata }
   * @returns {Object} Structured radiology report
   */
  async analyzeImage(imageBuffer, mimeType, options = {}) {
    await this.initialize();

    const modality = options.modality || this.detectModality(mimeType, options.dicomMetadata);
    const modalityPrompt = this.getModalityPrompt(modality);

    let contextInfo = '';
    if (options.clinicalHistory) {
      contextInfo += `\nClinical History: ${options.clinicalHistory}`;
    }
    if (options.bodyPart) {
      contextInfo += `\nBody Part: ${options.bodyPart}`;
    }
    if (options.dicomMetadata) {
      const dm = options.dicomMetadata;
      if (dm.studyDescription) contextInfo += `\nStudy Description: ${dm.studyDescription}`;
      if (dm.modality) contextInfo += `\nDICOM Modality: ${dm.modality}`;
      if (dm.bodyPartExamined) contextInfo += `\nBody Part Examined: ${dm.bodyPartExamined}`;
      if (dm.institution) contextInfo += `\nInstitution: ${dm.institution}`;
    }

    const systemPrompt = `${modalityPrompt}
${contextInfo}

You MUST structure your response in the following exact format with these section headers:

TECHNIQUE:
[Describe the imaging technique, views, contrast if applicable]

FINDINGS:
[Provide detailed, systematic findings organized by anatomy/structure]

IMPRESSION:
[Concise summary of key findings and most likely diagnoses]

RECOMMENDATIONS:
[Follow-up studies, clinical correlation, or management suggestions]

MEASUREMENTS:
[Any specific measurements in mm/cm, or "None" if not applicable]

BI-RADS:
[BI-RADS category if breast imaging, otherwise "N/A"]

URGENCY:
[routine | urgent | critical]`;

    const response = await this.claude.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBuffer.toString('base64')
            }
          },
          {
            type: 'text',
            text: 'Please analyze this medical image and provide a structured radiology report.'
          }
        ]
      }],
      system: systemPrompt
    });

    const rawText = response.content[0]?.text || '';
    const parsed = this.parseRadiologyReport(rawText);
    parsed.modality = modality;
    parsed.rawReport = rawText;
    parsed.analysisSource = 'claude';
    parsed.aiModelVersion = this.modelId;

    // Save results if patientId and context provided
    if (options.patientId && options.practiceId) {
      try {
        await this.saveResults(parsed, options);
      } catch (saveErr) {
        console.error('⚠️ Failed to save image analysis results:', saveErr.message);
      }
    }

    return parsed;
  }

  /**
   * Compare two images (e.g., pre/post treatment, follow-up)
   * @param {Buffer} image1Buffer - First image
   * @param {Buffer} image2Buffer - Second image
   * @param {string} mimeType1 - First image MIME type
   * @param {string} mimeType2 - Second image MIME type
   * @param {Object} options - { modality, clinicalHistory, patientId, practiceId }
   * @returns {Object} Comparison report
   */
  async compareImages(image1Buffer, mimeType1, image2Buffer, mimeType2, options = {}) {
    await this.initialize();

    const modality = options.modality || 'general';
    const modalityPrompt = this.getModalityPrompt(modality);

    const response = await this.claude.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType1,
              data: image1Buffer.toString('base64')
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType2,
              data: image2Buffer.toString('base64')
            }
          },
          {
            type: 'text',
            text: `Compare these two medical images. The first is the prior study and the second is the current study.
${options.clinicalHistory ? `Clinical History: ${options.clinicalHistory}` : ''}

Provide:
1. CHANGES: What has changed between the two studies
2. PROGRESSION: Whether findings have improved, worsened, or remained stable
3. NEW FINDINGS: Any new abnormalities in the current study
4. RESOLVED FINDINGS: Any prior abnormalities that have resolved
5. MEASUREMENTS: Comparative measurements if applicable
6. IMPRESSION: Overall comparison summary
7. RECOMMENDATIONS: Follow-up recommendations`
          }
        ]
      }],
      system: modalityPrompt
    });

    const rawText = response.content[0]?.text || '';
    return {
      comparison: rawText,
      analysisSource: 'claude',
      aiModelVersion: this.modelId,
      modality
    };
  }

  /**
   * Analyze multiple images as a study (e.g., multi-view X-ray, MRI series)
   * @param {Array<{buffer: Buffer, mimeType: string}>} images - Array of image objects
   * @param {Object} options - { modality, clinicalHistory, patientId, practiceId }
   * @returns {Object} Study analysis report
   */
  async analyzeStudy(images, options = {}) {
    await this.initialize();

    if (!images || images.length === 0) {
      throw new Error('At least one image is required for study analysis');
    }

    // Claude supports up to 20 images per message
    const maxImages = Math.min(images.length, 20);
    const modality = options.modality || 'general';
    const modalityPrompt = this.getModalityPrompt(modality);

    const content = [];
    for (let i = 0; i < maxImages; i++) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: images[i].mimeType,
          data: images[i].buffer.toString('base64')
        }
      });
    }

    content.push({
      type: 'text',
      text: `This is a multi-image study with ${maxImages} images.
${options.clinicalHistory ? `Clinical History: ${options.clinicalHistory}` : ''}

Analyze all images as a complete study. Provide a unified report with:

TECHNIQUE:
[Describe the imaging technique and views shown]

FINDINGS:
[Comprehensive findings correlating information across all images]

IMPRESSION:
[Summary integrating findings from all images]

RECOMMENDATIONS:
[Follow-up recommendations]

MEASUREMENTS:
[Key measurements from across the study]

URGENCY:
[routine | urgent | critical]`
    });

    const response = await this.claude.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content }],
      system: modalityPrompt
    });

    const rawText = response.content[0]?.text || '';
    const parsed = this.parseRadiologyReport(rawText);
    parsed.modality = modality;
    parsed.rawReport = rawText;
    parsed.analysisSource = 'claude';
    parsed.aiModelVersion = this.modelId;
    parsed.imageCount = maxImages;

    return parsed;
  }

  // ─── Report Parser ────────────────────────────────────────────────

  parseRadiologyReport(text) {
    const result = {
      technique: '',
      findings: '',
      impression: '',
      recommendations: '',
      measurements: [],
      biRads: null,
      urgency: 'routine'
    };

    if (!text) return result;

    // Extract sections by header
    const sectionPatterns = {
      technique: /TECHNIQUE:\s*([\s\S]*?)(?=(?:FINDINGS:|IMPRESSION:|RECOMMENDATIONS:|MEASUREMENTS:|BI-RADS:|URGENCY:|$))/i,
      findings: /FINDINGS:\s*([\s\S]*?)(?=(?:IMPRESSION:|RECOMMENDATIONS:|MEASUREMENTS:|BI-RADS:|URGENCY:|$))/i,
      impression: /IMPRESSION:\s*([\s\S]*?)(?=(?:RECOMMENDATIONS:|MEASUREMENTS:|BI-RADS:|URGENCY:|$))/i,
      recommendations: /RECOMMENDATIONS:\s*([\s\S]*?)(?=(?:MEASUREMENTS:|BI-RADS:|URGENCY:|$))/i,
      measurements: /MEASUREMENTS:\s*([\s\S]*?)(?=(?:BI-RADS:|URGENCY:|$))/i,
      biRads: /BI-RADS:\s*([\s\S]*?)(?=(?:URGENCY:|$))/i,
      urgency: /URGENCY:\s*([\s\S]*?)$/i
    };

    for (const [key, pattern] of Object.entries(sectionPatterns)) {
      const match = text.match(pattern);
      if (match) {
        const value = match[1].trim();
        if (key === 'measurements') {
          if (value.toLowerCase() !== 'none') {
            result.measurements = value.split('\n')
              .map(line => line.replace(/^[-•*]\s*/, '').trim())
              .filter(line => line.length > 0);
          }
        } else if (key === 'biRads') {
          if (value.toLowerCase() !== 'n/a') {
            const biRadsMatch = value.match(/(\d)/);
            result.biRads = biRadsMatch ? parseInt(biRadsMatch[1]) : null;
            result.biRadsText = value;
          }
        } else if (key === 'urgency') {
          const urgencyLower = value.toLowerCase().trim();
          if (['routine', 'urgent', 'critical'].includes(urgencyLower)) {
            result.urgency = urgencyLower;
          } else if (urgencyLower.includes('critical')) {
            result.urgency = 'critical';
          } else if (urgencyLower.includes('urgent')) {
            result.urgency = 'urgent';
          }
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  // ─── Document Analysis Adapter ────────────────────────────────────

  /**
   * Adapter method that returns results in the same format as Gemini image analysis
   * Used by document-analysis.service.js as a drop-in replacement
   *
   * @param {Buffer} fileBuffer - Image data
   * @param {string} mimeType - Image MIME type
   * @param {Object} functionDeclaration - The function declaration from document analysis
   * @param {string} prompt - Additional prompt context
   * @returns {Object} { functionCalls: [{ name, args }] } matching Gemini output format
   */
  async analyzeImageForDocumentService(fileBuffer, mimeType, functionDeclaration, prompt) {
    await this.initialize();

    const modality = this.detectModality(mimeType);
    const parsed = await this.analyzeImage(fileBuffer, mimeType, { modality });

    // Build args matching the extractMedicalData function schema
    const args = {
      documentType: 'imaging',
      date: new Date().toISOString().split('T')[0],
      summary: parsed.rawReport || '',
      diagnoses: [],
      abnormalResults: [],
      recommendations: parsed.recommendations ? [parsed.recommendations] : [],
      testResults: [],
      notes: '',
      imagingType: this.mapModalityToImagingType(modality),
      bodyPart: '',
      findings: parsed.findings ? [parsed.findings] : [],
      urgencyLevel: parsed.urgency || 'routine',
      redFlags: parsed.urgency === 'critical' ? ['Critical findings detected'] : [],
      measurements: parsed.measurements || [],
      clinicalIndication: '',
      technique: parsed.technique || '',
      comparison: ''
    };

    // Extract body part from findings/technique
    if (parsed.technique) {
      const bodyParts = ['chest', 'abdomen', 'head', 'spine', 'knee', 'shoulder',
        'brain', 'heart', 'lungs', 'liver', 'kidneys', 'pelvis',
        'cervical', 'lumbar', 'thoracic', 'hip', 'ankle', 'wrist'];
      for (const part of bodyParts) {
        if (parsed.technique.toLowerCase().includes(part) ||
            (parsed.findings && parsed.findings.toLowerCase().includes(part))) {
          args.bodyPart = part.charAt(0).toUpperCase() + part.slice(1);
          break;
        }
      }
    }

    // Extract diagnoses from impression
    if (parsed.impression) {
      const sentences = parsed.impression.split(/[.;]/).map(s => s.trim()).filter(s => s.length > 5);
      args.diagnoses = sentences.slice(0, 5);
    }

    // Extract abnormal results
    if (parsed.findings) {
      const abnormalKeywords = ['fracture', 'mass', 'lesion', 'opacity', 'effusion',
        'hemorrhage', 'edema', 'stenosis', 'obstruction', 'nodule',
        'consolidation', 'pneumothorax', 'cardiomegaly', 'hernia'];
      const findingsLower = parsed.findings.toLowerCase();
      args.abnormalResults = abnormalKeywords.filter(k => findingsLower.includes(k));
    }

    // BI-RADS scoring for mammography
    if (parsed.biRads !== null) {
      args.notes = `BI-RADS Category ${parsed.biRads}${parsed.biRadsText ? ': ' + parsed.biRadsText : ''}`;
    }

    return {
      functionCalls: [{
        name: functionDeclaration.name,
        args
      }]
    };
  }

  mapModalityToImagingType(modality) {
    const map = {
      xray: 'X-ray',
      ct: 'CT',
      mri: 'MRI',
      ultrasound: 'Ultrasound',
      mammogram: 'Mammography',
      pet: 'PET',
      general: 'Imaging Study'
    };
    return map[modality] || 'Imaging Study';
  }

  // ─── Save Results ─────────────────────────────────────────────────

  async saveResults(parsed, options) {
    const { ObjectId } = require('mongodb');
    const radiologyFieldMappingService = require('./radiologyFieldMappingService');

    const context = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'saveImageAnalysis',
      practiceId: options.practiceId
    };

    const extractedData = {
      date: options.studyDate || new Date().toISOString().split('T')[0]
    };

    const reportData = {
      examType: this.mapModalityToImagingType(parsed.modality),
      clinicalIndication: options.clinicalHistory || '',
      comparison: '',
      technique: parsed.technique || '',
      findings: parsed.findings || '',
      impression: parsed.impression || '',
      recommendations: parsed.recommendations || '',
      criticalFindings: parsed.urgency === 'critical' ? ['Critical finding detected - see impression'] : [],
      reportingStandard: parsed.biRads !== null ? `BI-RADS ${parsed.biRads}` : '',
      analysisSource: 'claude',
      aiModelVersion: this.modelId
    };

    await radiologyFieldMappingService.saveRadiologyReport(
      reportData,
      options.patientId,
      options.documentId || null,
      extractedData,
      context
    );
  }

  // ─── Patient Imaging History ──────────────────────────────────────

  async getPatientImagingHistory(patientId, practiceId, options = {}) {
    const context = {
      serviceId: this.serviceId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'getImagingHistory',
      practiceId
    };

    const query = { patientId };
    if (options.modality) query.examType = options.modality;

    const results = await SecureDataAccess.query('radiology_reports', query, {
      sort: { reportDate: -1 },
      limit: options.limit || 50
    }, context);

    return results;
  }
}

module.exports = new ClaudeMedicalImageService();
