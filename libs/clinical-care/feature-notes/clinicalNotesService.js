// Clinical Notes Service
// Migrated to DDD NX architecture - Clinical Care Context - Notes Feature
// Manages clinical notes creation, editing, templates, and voice transcription

const crypto = require('crypto');

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Clinical Notes Service
 * Handles creation, editing, and management of clinical notes
 */
class ClinicalNotesService {
  constructor() {
    this.serviceId = 'clinical-notes-service';
    this.serviceToken = null;
    this.initialized = false;
    this.noteTemplates = new Map();
    this.activeEdits = new Map();
    this.autoSaveInterval = 30000;
    this.autoSaveTimers = new Map();
  }

  async initialize() {
    if (this.initialized) return this;

    try {
      // Authenticate service with serviceAccountManager
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Load note templates
      await this.loadNoteTemplates();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'clinicalNotesService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ ClinicalNotesService initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize ClinicalNotesService:', error);
      throw error;
    }
  }

  async loadNoteTemplates() {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'load-note-templates',
        practiceId: 'global'
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const templates = await SecureDataAccess.query(
        'note_templates',
        { isActive: true },
        { limit: 100 },
        context
      );

      templates.forEach(template => {
        this.noteTemplates.set(template.templateId, {
          name: template.name,
          specialty: template.specialty,
          category: template.category,
          sections: template.sections || [],
          requiredFields: template.requiredFields || [],
          validationRules: template.validationRules || {},
          version: template.version
        });
      });

      if (this.noteTemplates.size === 0) {
        this.loadDefaultTemplates();
      }
    } catch (error) {
      console.error('Failed to load note templates:', error);
      this.loadDefaultTemplates();
    }
  }

  loadDefaultTemplates() {
    const soapTemplate = {
      name: 'SOAP Note',
      specialty: 'general',
      category: 'progress_note',
      sections: [
        { id: 'subjective', title: 'Subjective', required: true, prompt: 'Patient complaints and history' },
        { id: 'objective', title: 'Objective', required: true, prompt: 'Physical exam findings and test results' },
        { id: 'assessment', title: 'Assessment', required: true, prompt: 'Clinical assessment and diagnosis' },
        { id: 'plan', title: 'Plan', required: true, prompt: 'Treatment plan and follow-up' }
      ],
      requiredFields: ['subjective', 'objective', 'assessment', 'plan'],
      validationRules: {
        minLength: { subjective: 20, objective: 20, assessment: 10, plan: 10 }
      },
      version: '1.0'
    };

    const consultationTemplate = {
      name: 'Consultation Note',
      specialty: 'general',
      category: 'consultation',
      sections: [
        { id: 'reason', title: 'Reason for Consultation', required: true },
        { id: 'history', title: 'History of Present Illness', required: true },
        { id: 'past_medical', title: 'Past Medical History', required: false },
        { id: 'medications', title: 'Current Medications', required: true },
        { id: 'allergies', title: 'Allergies', required: true },
        { id: 'physical_exam', title: 'Physical Examination', required: true },
        { id: 'impression', title: 'Clinical Impression', required: true },
        { id: 'recommendations', title: 'Recommendations', required: true }
      ],
      requiredFields: ['reason', 'history', 'medications', 'allergies', 'physical_exam', 'impression', 'recommendations'],
      validationRules: {},
      version: '1.0'
    };

    const progressTemplate = {
      name: 'Progress Note',
      specialty: 'general',
      category: 'progress_note',
      sections: [
        { id: 'chief_complaint', title: 'Chief Complaint', required: true },
        { id: 'interval_history', title: 'Interval History', required: true },
        { id: 'review_systems', title: 'Review of Systems', required: false },
        { id: 'physical_exam', title: 'Physical Exam', required: true },
        { id: 'assessment_plan', title: 'Assessment & Plan', required: true }
      ],
      requiredFields: ['chief_complaint', 'interval_history', 'physical_exam', 'assessment_plan'],
      validationRules: {},
      version: '1.0'
    };

    this.noteTemplates.set('soap-note', soapTemplate);
    this.noteTemplates.set('consultation-note', consultationTemplate);
    this.noteTemplates.set('progress-note', progressTemplate);
  }

  /**
   * Create a new clinical note
   */
  async createNote(noteData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        patientId,
        noteType,
        title,
        content,
        structuredData,
        templateId,
        specialty,
        visitId,
        audioFileUrl,
        sharedWith = []
      } = noteData;

      const context = {
        serviceId: this.serviceId,
        operation: 'create-note',
        practiceId: practiceContext.practiceId || 'global'
      };

      const noteProxy = getServiceProxy();
      
      // Get all compliance-related services
      const secureDataAccess = noteProxy.getService('secureDataAccess');
      const encryptionService = noteProxy.getService('encryptionService');
      const auditService = noteProxy.getService('auditService');
      const phiDetector = noteProxy.getService('phiDetectionService');

      const patients = await secureDataAccess.query(
        'patients',
        { _id: patientId },
        { limit: 1 },
        context
      );
      const patient = patients[0];

      if (!patient) {
        throw new Error('Patient not found');
      }

      if (templateId) {
        const template = this.noteTemplates.get(templateId);
        if (template) {
          this.validateNoteAgainstTemplate(structuredData, template);
        }
      }

      // Ensure HIPAA compliance
      const hasPHI = await phiDetector.scan(JSON.stringify(content));
      let encryptedContent;
      if (hasPHI) {
        encryptedContent = await encryptionService.encryptPHI(JSON.stringify(content));
      } else {
        encryptedContent = await encryptionService.encrypt(JSON.stringify(content), 'phi');
      }

      const noteId = crypto.randomBytes(16).toString('hex');

      const clinicalNote = {
        noteId,
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        noteType: noteType || 'progress_note',
        title: title || `Clinical Note - ${new Date().toLocaleDateString()}`,
        content: encryptedContent,
        structuredData: structuredData || {},
        templateId,
        specialty: specialty || 'general',
        visitId,
        audioFileUrl,
        status: 'draft',
        version: 1,
        sharedWith,
        comments: [],
        editHistory: [{
          version: 1,
          editedBy: practiceContext.userId,
          editedAt: new Date(),
          action: 'created'
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save with audit trail
      const result = await secureDataAccess.create('clinical_notes', clinicalNote, context);
      await auditService.logHIPAAAccess('CREATE_NOTE', practiceContext.userId, patientId);

      this.setupAutoSave(noteId, practiceContext);

      await secureDataAccess.create('audit_logs', {
        action: 'CLINICAL_NOTE_CREATED',
        category: 'clinical',
        patientId,
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: {
          noteId,
          noteType,
          templateId
        },
        timestamp: new Date()
      }, context);

      return {
        noteId,
        title: clinicalNote.title,
        status: clinicalNote.status,
        createdAt: clinicalNote.createdAt
      };
    } catch (error) {
      console.error('Failed to create clinical note:', error);
      throw error;
    }
  }

  validateNoteAgainstTemplate(structuredData, template) {
    const errors = [];

    template.requiredFields.forEach(field => {
      if (!structuredData[field] || structuredData[field].trim() === '') {
        errors.push(`Required field '${field}' is missing`);
      }
    });

    if (template.validationRules.minLength) {
      Object.entries(template.validationRules.minLength).forEach(([field, minLength]) => {
        if (structuredData[field] && structuredData[field].length < minLength) {
          errors.push(`Field '${field}' must be at least ${minLength} characters`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Note validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Update an existing clinical note
   */
  async updateNote(noteId, updates, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'update-note',
        practiceId: practiceContext.practiceId || 'global'
      };

      const existingNotes = await secureDataAccess.query(
        'clinical_notes',
        { noteId },
        { limit: 1 },
        context
      );
      const existingNote = existingNotes[0];

      if (!existingNote) {
        throw new Error('Clinical note not found');
      }

      if (existingNote.status === 'finalized' && !practiceContext.canEditFinalized) {
        throw new Error('Cannot edit finalized note');
      }

      const editLock = this.activeEdits.get(noteId);
      if (editLock && editLock.userId !== practiceContext.userId) {
        throw new Error(`Note is currently being edited by another user`);
      }

      let encryptedContent = existingNote.content;
      if (updates.content) {
        encryptedContent = await encryptionService.encrypt(
          JSON.stringify(updates.content),
          'phi'
        );
      }

      const updatedNote = {
        ...updates,
        content: encryptedContent,
        version: existingNote.version + 1,
        updatedAt: new Date()
      };

      if (!existingNote.editHistory) {
        existingNote.editHistory = [];
      }

      existingNote.editHistory.push({
        version: updatedNote.version,
        editedBy: practiceContext.userId,
        editedAt: new Date(),
        action: 'updated',
        changes: Object.keys(updates).filter(k => k !== 'content')
      });

      updatedNote.editHistory = existingNote.editHistory;

      await secureDataAccess.update(
        'clinical_notes',
        { noteId },
        updatedNote,
        context
      );

      await secureDataAccess.create('audit_logs', {
        action: 'CLINICAL_NOTE_UPDATED',
        category: 'clinical',
        patientId: existingNote.patientId,
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: {
          noteId,
          version: updatedNote.version,
          changes: Object.keys(updates)
        },
        timestamp: new Date()
      }, context);

      return {
        noteId,
        version: updatedNote.version,
        updatedAt: updatedNote.updatedAt
      };
    } catch (error) {
      console.error('Failed to update clinical note:', error);
      throw error;
    }
  }

  /**
   * Get notes by patient ID
   */
  async getNotesByPatient(patientId, filters, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const query = {
        patientId,
        practiceId: practiceContext.practiceId || 'global'
      };

      if (filters.noteType) {
        query.noteType = filters.noteType;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      if (filters.status) {
        query.status = filters.status;
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-notes-by-patient',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        query,
        { 
          sort: { createdAt: -1 },
          limit: filters.limit || 50
        },
        context
      );

      const decryptedNotes = await Promise.all(notes.map(async note => {
        try {
          const decryptedContent = await encryptionService.decrypt(note.content);
          return {
            ...note,
            content: JSON.parse(decryptedContent)
          };
        } catch (error) {
          console.error('Failed to decrypt note content:', error);
          return {
            ...note,
            content: null,
            decryptionError: true
          };
        }
      }));

      return decryptedNotes;
    } catch (error) {
      console.error('Failed to get patient notes:', error);
      throw error;
    }
  }

  /**
   * Delete a clinical note (soft delete)
   */
  async deleteNote(noteId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'delete-note',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        { noteId },
        { limit: 1 },
        context
      );
      const note = notes[0];

      if (!note) {
        throw new Error('Clinical note not found');
      }

      if (note.status === 'finalized') {
        throw new Error('Cannot delete finalized note');
      }

      await secureDataAccess.update(
        'clinical_notes',
        { noteId },
        { 
          status: 'deleted',
          deletedBy: practiceContext.userId,
          deletedAt: new Date()
        },
        context
      );

      this.clearAutoSave(noteId);

      await secureDataAccess.create('audit_logs', {
        action: 'CLINICAL_NOTE_DELETED',
        category: 'clinical',
        patientId: note.patientId,
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: {
          noteId,
          noteType: note.noteType
        },
        timestamp: new Date()
      }, context);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete clinical note:', error);
      throw error;
    }
  }

  /**
   * Get note templates by specialty
   */
  async getTemplatesBySpecialty(specialty, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const templates = [];
      
      for (const [id, template] of this.noteTemplates) {
        if (template.specialty === specialty || template.specialty === 'general') {
          templates.push({
            templateId: id,
            ...template
          });
        }
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'get-templates-by-specialty',
        practiceId: practiceContext.practiceId || 'global'
      };

      const customTemplates = await secureDataAccess.query(
        'note_templates',
        { 
          practiceId: practiceContext.practiceId || 'global',
          specialty,
          isActive: true
        },
        { limit: 50 },
        context
      );

      return [...templates, ...customTemplates];
    } catch (error) {
      console.error('Failed to get templates by specialty:', error);
      throw error;
    }
  }

  /**
   * Create a custom note template
   */
  async createCustomTemplate(templateData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        name,
        specialty,
        category,
        sections,
        requiredFields,
        validationRules
      } = templateData;

      const templateId = crypto.randomBytes(16).toString('hex');

      const template = {
        templateId,
        practiceId: practiceContext.practiceId || 'global',
        createdBy: practiceContext.userId,
        name,
        specialty: specialty || 'general',
        category: category || 'custom',
        sections: sections || [],
        requiredFields: requiredFields || [],
        validationRules: validationRules || {},
        isActive: true,
        version: '1.0',
        usageCount: 0,
        createdAt: new Date()
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'create-custom-template',
        practiceId: practiceContext.practiceId || 'global'
      };

      await secureDataAccess.create(
        'note_templates',
        template,
        context
      );

      this.noteTemplates.set(templateId, template);

      await secureDataAccess.create('audit_logs', {
        action: 'NOTE_TEMPLATE_CREATED',
        category: 'configuration',
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: {
          templateId,
          name,
          specialty
        },
        timestamp: new Date()
      }, context);

      return template;
    } catch (error) {
      console.error('Failed to create custom template:', error);
      throw error;
    }
  }

  /**
   * Apply template to patient data
   */
  async applyTemplate(templateId, patientData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const template = this.noteTemplates.get(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const populatedSections = {};

      for (const section of template.sections) {
        populatedSections[section.id] = {
          title: section.title,
          content: '',
          required: section.required
        };

        if (section.id === 'medications' && patientData.medications) {
          populatedSections[section.id].content = patientData.medications
            .map(med => `${med.name} - ${med.dosage} - ${med.frequency}`)
            .join('\n');
        } else if (section.id === 'allergies' && patientData.allergies) {
          populatedSections[section.id].content = patientData.allergies.join(', ');
        } else if (section.id === 'past_medical' && patientData.medicalHistory) {
          populatedSections[section.id].content = patientData.medicalHistory.join('\n');
        }
      }

      return {
        templateId,
        templateName: template.name,
        sections: populatedSections,
        requiredFields: template.requiredFields,
        validationRules: template.validationRules
      };
    } catch (error) {
      console.error('Failed to apply template:', error);
      throw error;
    }
  }

  /**
   * Share note with other providers
   */
  async shareNote(noteId, shareWith, permissions, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'share-note',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        { noteId },
        { limit: 1 },
        context
      );
      const note = notes[0];

      if (!note) {
        throw new Error('Clinical note not found');
      }

      const shareData = shareWith.map(userId => ({
        userId,
        permissions: permissions[userId] || ['view'],
        sharedBy: practiceContext.userId,
        sharedAt: new Date()
      }));

      await secureDataAccess.update(
        'clinical_notes',
        { noteId },
        { 
          sharedWith: [...(note.sharedWith || []), ...shareData],
          updatedAt: new Date()
        },
        context
      );

      await secureDataAccess.create('audit_logs', {
        action: 'CLINICAL_NOTE_SHARED',
        category: 'clinical',
        patientId: note.patientId,
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: {
          noteId,
          sharedWithCount: shareWith.length
        },
        timestamp: new Date()
      }, context);

      return { success: true };
    } catch (error) {
      console.error('Failed to share note:', error);
      throw error;
    }
  }

  /**
   * Add comment to a note
   */
  async addNoteComment(noteId, comment, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'add-note-comment',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        { noteId },
        { limit: 1 },
        context
      );
      const note = notes[0];

      if (!note) {
        throw new Error('Clinical note not found');
      }

      const newComment = {
        commentId: crypto.randomBytes(8).toString('hex'),
        userId: practiceContext.userId,
        text: comment,
        timestamp: new Date()
      };

      await secureDataAccess.update(
        'clinical_notes',
        { noteId },
        { 
          $push: { comments: newComment },
          updatedAt: new Date()
        },
        context
      );

      return newComment;
    } catch (error) {
      console.error('Failed to add note comment:', error);
      throw error;
    }
  }

  /**
   * Lock note for editing
   */
  async lockNoteForEditing(noteId, userId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const existingLock = this.activeEdits.get(noteId);
      
      if (existingLock && existingLock.userId !== userId) {
        const lockAge = Date.now() - existingLock.timestamp;
        if (lockAge < 300000) {
          throw new Error(`Note is currently being edited by another user`);
        }
      }

      this.activeEdits.set(noteId, {
        userId,
        timestamp: Date.now(),
        practiceId: practiceContext.practiceId || 'global'
      });

      setTimeout(() => {
        const lock = this.activeEdits.get(noteId);
        if (lock && lock.userId === userId) {
          this.activeEdits.delete(noteId);
        }
      }, 300000);

      return { locked: true, expiresIn: 300000 };
    } catch (error) {
      console.error('Failed to lock note for editing:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio to text
   */
  async transcribeAudio(audioData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const { audioBase64, mimeType, language = 'en' } = audioData;

      const prompt = `
        Please transcribe this medical audio recording.
        Focus on medical terminology accuracy.
        Format as clinical note content.
        Language: ${language}
      `;

      const transcription = await geminiMedicalService.processAudioWithAI(
        audioBase64,
        prompt,
        { temperature: 0.3 }
      );

      const medicalTerms = this.extractMedicalTerms(transcription);
      
      return {
        transcription,
        confidence: 0.95,
        medicalTerms,
        language,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  extractMedicalTerms(text) {
    const medicalPatterns = [
      /\b(?:diagnosis|symptom|medication|prescription|treatment|procedure|surgery|therapy)\b/gi,
      /\b(?:hypertension|diabetes|asthma|COPD|CHF|CAD|stroke|MI|pneumonia)\b/gi,
      /\b(?:mg|ml|mcg|units?|tablets?|capsules?|daily|BID|TID|QID|PRN)\b/gi
    ];

    const terms = new Set();

    medicalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match.toLowerCase()));
      }
    });

    return Array.from(terms);
  }

  /**
   * Process voice note with template
   */
  async processVoiceNote(audioFile, templateId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const transcription = await this.transcribeAudio(audioFile, practiceContext);

      if (templateId) {
        const template = this.noteTemplates.get(templateId);
        if (template) {
          const structuredData = await this.structureTranscription(
            transcription.transcription,
            template
          );

          return {
            transcription: transcription.transcription,
            structuredData,
            templateId,
            confidence: transcription.confidence
          };
        }
      }

      return transcription;
    } catch (error) {
      console.error('Failed to process voice note:', error);
      throw error;
    }
  }

  async structureTranscription(transcription, template) {
    const prompt = `
      Structure the following medical transcription into sections:
      ${template.sections.map(s => s.title).join(', ')}

      Transcription: ${transcription}

      Return as JSON with section IDs as keys.
    `;

    const response = await geminiMedicalService.generateMedicalResponse(prompt, {
      temperature: 0.3,
      responseType: 'json'
    });

    return JSON.parse(response);
  }

  /**
   * Search notes
   */
  async searchNotes(searchCriteria, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        searchTerm,
        patientId,
        providerId,
        noteType,
        startDate,
        endDate,
        specialty,
        includeShared = false
      } = searchCriteria;

      const query = { practiceId: practiceContext.practiceId || 'global' };

      if (patientId) query.patientId = patientId;
      if (providerId) query.providerId = providerId;
      if (noteType) query.noteType = noteType;
      if (specialty) query.specialty = specialty;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      if (!includeShared) {
        query.$or = [
          { providerId: practiceContext.userId },
          { 'sharedWith.userId': practiceContext.userId }
        ];
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'search-notes',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        query,
        { limit: 100 },
        context
      );

      if (searchTerm) {
        const filteredNotes = [];
        
        for (const note of notes) {
          try {
            const decryptedContent = await encryptionService.decrypt(note.content);
            const contentString = JSON.stringify(decryptedContent).toLowerCase();
            
            if (contentString.includes(searchTerm.toLowerCase()) ||
                note.title.toLowerCase().includes(searchTerm.toLowerCase())) {
              filteredNotes.push(note);
            }
          } catch (error) {
            console.error('Failed to search note content:', error);
          }
        }

        return filteredNotes;
      }

      return notes;
    } catch (error) {
      console.error('Failed to search notes:', error);
      throw error;
    }
  }

  /**
   * Generate note analytics
   */
  async generateNoteAnalytics(filters, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const query = { practiceId: practiceContext.practiceId || 'global' };

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'generate-note-analytics',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        query,
        { limit: 10000 },
        context
      );

      const analytics = {
        totalNotes: notes.length,
        byType: {},
        bySpecialty: {},
        byProvider: {},
        byStatus: {},
        averageLength: 0,
        templatesUsed: {},
        voiceNotesCount: 0
      };

      notes.forEach(note => {
        analytics.byType[note.noteType] = (analytics.byType[note.noteType] || 0) + 1;
        analytics.bySpecialty[note.specialty] = (analytics.bySpecialty[note.specialty] || 0) + 1;
        analytics.byProvider[note.providerId] = (analytics.byProvider[note.providerId] || 0) + 1;
        analytics.byStatus[note.status] = (analytics.byStatus[note.status] || 0) + 1;
        
        if (note.templateId) {
          analytics.templatesUsed[note.templateId] = (analytics.templatesUsed[note.templateId] || 0) + 1;
        }
        
        if (note.audioFileUrl) {
          analytics.voiceNotesCount++;
        }
      });

      analytics.completionRate = notes.filter(n => n.status === 'finalized').length / notes.length * 100;
      analytics.collaborationRate = notes.filter(n => n.sharedWith && n.sharedWith.length > 0).length / notes.length * 100;

      return analytics;
    } catch (error) {
      console.error('Failed to generate note analytics:', error);
      throw error;
    }
  }

  setupAutoSave(noteId, practiceContext) {
    const timer = setInterval(async () => {
      try {
        const context = {
          serviceId: this.serviceId,
          operation: 'auto-save',
          practiceId: practiceContext.practiceId || 'global'
        };

        const notes = await secureDataAccess.query(
          'clinical_notes',
          { noteId },
          { limit: 1 },
          context
        );
        const note = notes[0];

        if (note && note.status === 'draft') {
          await secureDataAccess.update(
            'clinical_notes',
            { noteId },
            { autoSavedAt: new Date() },
            context
          );
        } else {
          this.clearAutoSave(noteId);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.autoSaveInterval);

    this.autoSaveTimers.set(noteId, timer);
  }

  clearAutoSave(noteId) {
    const timer = this.autoSaveTimers.get(noteId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(noteId);
    }
  }

  /**
   * Finalize a note (make it read-only)
   */
  async finalizeNote(noteId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'finalize-note',
        practiceId: practiceContext.practiceId || 'global'
      };

      const notes = await secureDataAccess.query(
        'clinical_notes',
        { noteId },
        { limit: 1 },
        context
      );
      const note = notes[0];

      if (!note) {
        throw new Error('Clinical note not found');
      }

      if (note.status === 'finalized') {
        return { already_finalized: true };
      }

      await secureDataAccess.update(
        'clinical_notes',
        { noteId },
        { 
          status: 'finalized',
          finalizedBy: practiceContext.userId,
          finalizedAt: new Date()
        },
        context
      );

      this.clearAutoSave(noteId);

      await secureDataAccess.create('audit_logs', {
        action: 'CLINICAL_NOTE_FINALIZED',
        category: 'clinical',
        patientId: note.patientId,
        userId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        metadata: { noteId },
        timestamp: new Date()
      }, context);

      return { success: true };
    } catch (error) {
      console.error('Failed to finalize note:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      templatesLoaded: this.noteTemplates.size,
      activeEdits: this.activeEdits.size,
      autoSaveTimers: this.autoSaveTimers.size
    };
  }
}

// Create and export singleton
const clinicalNotesService = new ClinicalNotesService();

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('clinicalNotesService', () => {
    return module.exports;
  });
}

module.exports = clinicalNotesService;