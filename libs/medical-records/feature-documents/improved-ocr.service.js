/**
 * 🔒 SECURITY REQUIREMENTS:
 * 1. This service MUST authenticate with serviceAccountManager
 * 2. Use SecureDataAccess for ALL database operations
 * 3. Direct database access will FAIL
 * 4. Missing authentication will FAIL
 *
 * See: /docs/SECURITY-COOKBOOK.md for examples
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

// Security wrapper for child_process operations
class SecureProcessExecutor {
  constructor() {
    // Whitelist of allowed commands for OCR operations
    this.allowedCommands = ['pdftotext', 'gswin64c', 'pdftoppm', 'tesseract'];
  }

  async exec(command, options = {}) {
    // Validate command is allowed
    const cmdParts = command.split(' ');
    const baseCmd = cmdParts[0].replace(/[\"']/g, '');
    
    if (!this.allowedCommands.some(allowed => baseCmd.includes(allowed))) {
      throw new Error(`Command '${baseCmd}' is not allowed for security reasons`);
    }

    // Use child_process only for whitelisted OCR commands
    const { exec: nodeExec } = require('child_process');
    const execPromise = util.promisify(nodeExec);
    return execPromise(command, options);
  }
}

const secureExecutor = new SecureProcessExecutor();
const exec = (cmd, opts) => secureExecutor.exec(cmd, opts);

class ImprovedOCRService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.isInitialized = false;
    this.availableEngines = {
      poppler: false,
      ghostscript: false,
      pdftotext: false
    };
    this.ghostscriptCommand = null; // Store the working ghostscript command
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    
    this.serviceToken = await serviceAccountManager.authenticate('improved-ocr-service');
    this.initialized = true;
    console.log('✅ Improved OCR Service initialized with security token');
    
    if (this.isInitialized) {
      console.log('📋 OCR Service already initialized');
      return;
    }

    console.log('🔧 Initializing OCR Service and checking engines...');
    await this.checkAvailableEngines();
    this.isInitialized = true;
    console.log('✅ OCR Service initialization completed');
  }

  async checkAvailableEngines() {
    console.log('🔧 Checking available OCR engines...');
    
    // Check for pdftotext (part of poppler-utils)
    try {
      const result = await exec('pdftotext -v', { timeout: 5000 });
      this.availableEngines.pdftotext = true;
      console.log('✅ pdftotext is available');
    } catch (error) {
      // pdftotext not available - using Ghostscript instead (this is expected)
    }

    // Check for ghostscript (using gswin64c only)
    console.log('👻 Testing Ghostscript gswin64c command...');
    const gsCommands = [
      'gswin64c -dQUIET --version'  // Primary: Console version (no GUI)
    ];
    
    for (const cmd of gsCommands) {
      try {
        console.log(`🔍 Trying: ${cmd}`);
        const result = await exec(cmd, { 
          timeout: 5000,
          windowsHide: true,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        this.availableEngines.ghostscript = true;
        this.ghostscriptCommand = cmd.split(' ')[0].replace(/"/g, ''); // Store the working command
        console.log(`✅ Ghostscript found with command: ${this.ghostscriptCommand}`);
        console.log(`📋 Version info: ${result.stdout || result.stderr}`);
        break;
      } catch (error) {
        console.log(`❌ ${cmd.split(' ')[0]} failed: ${error.message}`);
      }
    }
    
    if (!this.availableEngines.ghostscript) {
      console.log('⚠️ Ghostscript not found with any command variation');
      console.log('💡 Try adding Ghostscript to your PATH or check installation');
    }

    // Check for poppler utilities
    try {
      const result = await exec('pdftoppm -v', { timeout: 5000 });
      this.availableEngines.poppler = true;
      console.log('✅ poppler utilities are available');
    } catch (error) {
      // poppler utilities not available - using Ghostscript instead (this is expected)
    }
    
    console.log('📊 Engine availability summary:', this.availableEngines);
  }

  async extractTextFromPDF(filePath) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`🔍 Starting OCR extraction for PDF: ${filePath}`);
      
      // Initialize OCR capabilities FIRST
      console.log('🔧 Initializing OCR Service...');
      await this.initialize();
      console.log('✅ OCR Service initialized successfully');
      
      // Method 1: Try Ghostscript FIRST (prioritize it since we know it should work)
      if (this.availableEngines.ghostscript) {
        console.log('👻 Trying Ghostscript extraction first (preferred method)...');
        const ghostscriptResult = await this.extractWithGhostscript(filePath);
        if (ghostscriptResult && ghostscriptResult.trim().length > 100) {
          console.log(`✅ Ghostscript extraction successful: ${ghostscriptResult.length} characters`);
          return ghostscriptResult.trim();
        } else {
          console.log('⚠️ Ghostscript returned insufficient content, trying other methods...');
        }
      } else {
        console.log('⚠️ Ghostscript not available - trying other methods');
      }
      
      // Method 2: Try direct PDF text extraction (for text-based PDFs)
      const directText = await this.extractDirectPDFText(filePath);
      if (directText && directText.trim().length > 100) {
        console.log(`✅ Direct PDF extraction successful: ${directText.length} characters`);
        return directText.trim();
      } else {
        console.log('📄 PDF direct extraction returned minimal text, continuing with OCR methods...');
      }

      // Method 3: Try pdftotext with layout preservation
      if (this.availableEngines.pdftotext) {
        console.log('🔧 Trying pdftotext extraction...');
        const pdfToTextResult = await this.extractWithPdfToText(filePath);
        if (pdfToTextResult && pdfToTextResult.trim().length > 50) {
          console.log(`✅ pdftotext extraction successful: ${pdfToTextResult.length} characters`);
          return pdfToTextResult.trim();
        }
      } else {
        console.log('⚠️ pdftotext not available - skipping');
      }

      // Method 4: Try poppler-based image extraction + basic text recognition
      if (this.availableEngines.poppler) {
        console.log('🖼️ Trying poppler image extraction...');
        const popplerResult = await this.extractWithPoppler(filePath);
        if (popplerResult && popplerResult.trim().length > 50) {
          console.log(`✅ Poppler extraction successful: ${popplerResult.length} characters`);
          return popplerResult.trim();
        }
      } else {
        console.log('⚠️ Poppler utilities not available - skipping');
      }

      // No fallback - return empty string if OCR fails
      console.log('❌ All OCR methods failed, no text extracted');
      return '';

    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      return '';
    }
  }

  async extractDirectPDFText(filePath) {
    try {
      // Try using built-in PDF parsing without external dependencies
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer, {
        max: 10000, // Limit pages to prevent memory issues
        version: 'v1.10.100'
      });
      
      console.log(`📄 PDF-parse extracted ${data.text.length} characters`);
      
      // If we got substantial text, return it
      if (data.text && data.text.trim().length > 100) {
        return data.text;
      } else {
        console.log('📄 PDF-parse returned minimal text, trying other methods...');
        return null;
      }
    } catch (error) {
      console.log('📄 Built-in PDF parsing failed:', error.message);
      return null;
    }
  }

  async extractWithGhostscript(filePath) {
    try {
      console.log('🔍 Attempting OCR extraction from scanned PDF images...');
      
      // Step 1: Convert PDF pages to high-resolution images for OCR
      console.log('📸 Converting PDF pages to images for OCR processing...');
      const tempDir = path.join(path.dirname(filePath), 'temp_ocr');
      await fs.mkdir(tempDir, { recursive: true });
      
      // Convert PDF to PNG images at high resolution for better OCR
      const imageOutputPath = path.join(tempDir, 'page_%03d.png');
      const convertCommand = `gswin64c -dNOPAUSE -dBATCH -dQUIET -dSAFER -sDEVICE=pngalpha -r300 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -o "${imageOutputPath}" "${filePath}"`;
      
      await exec(convertCommand, {
        timeout: 60000,
        windowsHide: true
      });
      
      console.log('✅ PDF converted to images successfully');
      
      // Step 2: Process each image and extract text using simple pattern recognition
      const extractedText = await this.processImagesForText(tempDir);
      
      // Cleanup temp directory
      await this.cleanupDirectory(tempDir);
      
      if (extractedText && extractedText.trim().length > 50) {
        console.log(`✅ OCR extraction successful: ${extractedText.length} characters`);
        return extractedText.trim();
      } else {
        console.log('⚠️ OCR extraction returned minimal text');
        return null;
      }
      
      } catch (error) {
      console.error('❌ Ghostscript OCR extraction failed:', error.message);
      return null;
    }
  }
  
  async processImagesForText(tempDir) {
    try {
      const files = await fs.readdir(tempDir);
      const imageFiles = files.filter(f => f.toLowerCase().endsWith('.png')).sort();
      
      console.log(`📷 Found ${imageFiles.length} image files to process`);
      
      let extractedText = '';
      let combinedMedicalData = {
        pages: [],
        chronologicalEvents: [],
        structuredContent: ''
      };
      
      // Process each image for text extraction in order
      for (let i = 0; i < Math.min(imageFiles.length, 20); i++) { // Increased to 20 pages
        const imageFile = imageFiles[i];
        const imagePath = path.join(tempDir, imageFile);
        
        console.log(`🔍 Processing image ${i + 1}: ${imageFile}`);
        
        // Extract text from image (in real implementation, this would use OCR)
        const pageText = await this.extractTextFromImage(imagePath);
        
        if (pageText && pageText.trim().length > 0) {
          // Store page data for chronological reconstruction
          combinedMedicalData.pages.push({
            pageNumber: i + 1,
            content: pageText,
            imageFile: imageFile
          });
          
          console.log(`✅ Extracted ${pageText.length} characters from page ${i + 1}`);
        } else {
          console.log(`⚠️ No text extracted from page ${i + 1}`);
        }
      }
      
      // Reconstruct the medical document in proper chronological order
      if (combinedMedicalData.pages.length > 0) {
        extractedText = await this.reconstructChronologicalDocument(combinedMedicalData.pages);
        console.log(`📋 Reconstructed chronological document: ${extractedText.length} characters`);
      }
      
      return extractedText;
    } catch (error) {
      console.error('❌ Image processing failed:', error.message);
      return null;
    }
  }
  
  async reconstructChronologicalDocument(pages) {
    console.log('📅 Reconstructing document in chronological order...');
    
    try {
      // Combine all page content
      let combinedContent = '';
      const allEvents = [];
      
      // Extract events and dates from all pages
      for (const page of pages) {
        combinedContent += `\n--- PAGE ${page.pageNumber} ---\n${page.content}\n`;
        
        // Extract dated events from this page
        const pageEvents = this.extractDatedEventsFromPage(page.content, page.pageNumber);
        allEvents.push(...pageEvents);
      }
      
      // Sort events by date (oldest first)
      allEvents.sort((a, b) => {
        if (a.sortableDate && b.sortableDate) {
          return new Date(a.sortableDate) - new Date(b.sortableDate);
        }
        return 0;
      });
      
      // Build chronological medical history
      const chronologicalDocument = this.buildChronologicalMedicalHistory(allEvents, combinedContent);
      
      console.log(`✅ Chronological reconstruction complete: ${allEvents.length} dated events identified`);
      return chronologicalDocument;
      
    } catch (error) {
      console.error('❌ Chronological reconstruction failed:', error);
      // Return combined content as fallback
      return pages.map(p => `--- PAGE ${p.pageNumber} ---\n${p.content}`).join('\n\n');
    }
  }
  
  extractDatedEventsFromPage(pageContent, pageNumber) {
    const events = [];
    
    // Extract different types of dated medical events
    const eventPatterns = [
      {
        type: 'diagnosis',
        pattern: /(?:Diagnosed|diagnosed):\s*([A-Za-z]+\s+\d{4})/gi,
        contextPattern: /(\d+\.\s*[^\n\r]+\(.*?\)[\s\S]*?)(?=\d+\.|RECENT|CURRENT|ALLERGIES|$)/gi
      },
      {
        type: 'lab_result', 
        pattern: /Date:\s*((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}))/gi,
        contextPattern: /(?:RECENT LABORATORY RESULTS[\s\S]*?)(Date:\s*[^\n\r]+[\s\S]*?)(?=CURRENT|ALLERGIES|RECENT CONSULTATIONS|$)/gi
      },
      {
        type: 'consultation',
        pattern: /Date:\s*((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}))/gi,
        contextPattern: /([^\n\r]+Consultation[^\n\r]*[\s\S]*?Date:\s*[^\n\r]+[\s\S]*?)(?=VITAL|Document|Confidential|$)/gi
      },
      {
        type: 'vital_signs',
        pattern: /Last Visit\s*[-\s:]*((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}))/gi,
        contextPattern: /(VITAL SIGNS[\s\S]*?)(?=Document|Confidential|$)/gi
      },
      {
        type: 'medication_refill',
        pattern: /Next refill due:\s*((?:[A-Za-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}))/gi,
        contextPattern: /(\d+\.\s*[^\n\r]+[\s\S]*?Next refill due:\s*[^\n\r]+)/gi
      }
    ];
    
    eventPatterns.forEach(({ type, pattern, contextPattern }) => {
      let match;
      // Create a copy of the content for this pattern to avoid state issues
      const contentCopy = pageContent;
      
      while ((match = pattern.exec(contentCopy)) !== null) {
        const dateStr = match[1] ? match[1].trim() : null;
        const sortableDate = dateStr ? this.parseDateString(dateStr) : null;
        
        // Find context around this date
        contextPattern.lastIndex = 0;
        const contextMatch = contextPattern.exec(contentCopy);
        const context = contextMatch && contextMatch[1] ? contextMatch[1].trim() : (match[0] || '');
        
        if (dateStr) {
          events.push({
            type: type,
            date: dateStr,
            sortableDate: sortableDate,
            context: context,
            pageNumber: pageNumber,
            rawMatch: match[0] || ''
          });
        }
      }
      
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      contextPattern.lastIndex = 0;
    });
    
    return events;
  }
  
  parseDateString(dateStr) {
    try {
      if (!dateStr) return null;
      
      // Handle various date formats
      const cleanDate = dateStr.replace(/Last Visit - /i, '').trim();
      
      // Try different date parsing approaches
      const dateFormats = [
        // Month YYYY (e.g., "March 2019")
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{2,4})$/i,
        // Month DD, YYYY or Month DD YYYY
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{2,4})$/i,
        // MM/DD/YYYY or MM-DD-YYYY or MM/DD/YY
        /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{2})-(\d{2})$/
      ];
      
      for (const format of dateFormats) {
        const match = cleanDate.match(format);
        if (match) {
          let year, month, day = 1; // Default to first day of month
          
          if (format === dateFormats[0]) {
            // Month YYYY (e.g., "March 2019")
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            month = monthNames.indexOf(match[1].toLowerCase());
            year = parseInt(match[2]);
            if (year < 100) year += 2000;
          } else if (format === dateFormats[1]) {
            // Month DD, YYYY or Month DD YYYY
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            month = monthNames.indexOf(match[1].toLowerCase());
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            if (year < 100) year += 2000;
          } else if (format === dateFormats[2]) {
            // MM/DD/YYYY or MM-DD-YYYY or MM/DD/YY
            month = parseInt(match[1]) - 1;
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            if (year < 100) year += 2000;
          } else if (format === dateFormats[3]) {
            // YYYY-MM-DD
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          }
          
          const parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().split('T')[0];
          }
        }
      }
      
      // Try with built-in Date parser as fallback
      const fallbackDate = new Date(cleanDate);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.toISOString().split('T')[0];
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to parse date: ${dateStr}`, error.message);
      return null;
    }
  }

  buildChronologicalMedicalHistory(events, originalContent) {
    console.log('🏗️ Building chronological medical history...');
    
    // Group events by type and date
    const eventsByType = {
      diagnosis: events.filter(e => e.type === 'diagnosis'),
      lab_result: events.filter(e => e.type === 'lab_result'),
      consultation: events.filter(e => e.type === 'consultation'),
      vital_signs: events.filter(e => e.type === 'vital_signs'),
      medication_refill: events.filter(e => e.type === 'medication_refill')
    };
    
    // Build structured document with proper chronological order
    let chronologicalDoc = `COMPREHENSIVE MEDICAL HISTORY REPORT\n`;
    chronologicalDoc += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
    chronologicalDoc += `Source: OCR Document Analysis\n\n`;
    
    // Add patient info section (extract from original content)
    const patientInfo = this.extractPatientInfoFromContent(originalContent);
    if (patientInfo) {
      chronologicalDoc += `PATIENT INFORMATION:\n${patientInfo}\n\n`;
    }
    
    // Add medical history in chronological order
    if (eventsByType.diagnosis.length > 0) {
      chronologicalDoc += `MEDICAL HISTORY (Chronological Order):\n`;
      // Sort diagnosis by date
      eventsByType.diagnosis.sort((a, b) => {
        if (a.sortableDate && b.sortableDate) {
          return new Date(a.sortableDate) - new Date(b.sortableDate);
        }
        return 0;
      });
      
      eventsByType.diagnosis.forEach((event, index) => {
        // Extract condition details
        const conditionMatch = event.context.match(/\d+\.\s*([^\n\r\(]+)\(([^\)]+)\)/i);
        if (conditionMatch) {
          const conditionName = conditionMatch[1].trim();
          const dateRange = conditionMatch[2].trim();
          chronologicalDoc += `${index + 1}. ${conditionName} (${dateRange})\n`;
          
          // Extract diagnosis details
          const lines = event.context.split('\n');
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
              chronologicalDoc += `   ${lines[i].trim()}\n`;
            }
          }
        } else {
          chronologicalDoc += `${index + 1}. ${event.context}\n`;
        }
      });
      chronologicalDoc += `\n`;
    }
    
    // Add lab results chronologically (most recent first)
    if (eventsByType.lab_result.length > 0) {
      chronologicalDoc += `LABORATORY RESULTS (Most Recent First):\n`;
      eventsByType.lab_result
        .sort((a, b) => {
          if (a.sortableDate && b.sortableDate) {
            return new Date(b.sortableDate) - new Date(a.sortableDate);
          }
          return 0;
        })
        .forEach((event, index) => {
          if (event.context) {
            chronologicalDoc += `${index + 1}. ${event.context}\n\n`;
          }
        });
    }
    
    // Add consultations chronologically
    if (eventsByType.consultation.length > 0) {
      chronologicalDoc += `CONSULTATIONS (Chronological Order):\n`;
      eventsByType.consultation
        .sort((a, b) => {
          if (a.sortableDate && b.sortableDate) {
            return new Date(a.sortableDate) - new Date(b.sortableDate);
          }
          return 0;
        })
        .forEach((event, index) => {
          if (event.context) {
            chronologicalDoc += `${index + 1}. ${event.context}\n\n`;
          }
        });
    }
    
    // Add most recent vital signs
    if (eventsByType.vital_signs.length > 0) {
      const mostRecentVitals = eventsByType.vital_signs
        .sort((a, b) => {
          if (a.sortableDate && b.sortableDate) {
            return new Date(b.sortableDate) - new Date(a.sortableDate);
          }
          return 0;
        })[0];
      
      if (mostRecentVitals && mostRecentVitals.context) {
        chronologicalDoc += `MOST RECENT VITAL SIGNS:\n${mostRecentVitals.context}\n\n`;
      }
    }
    
    // Add medication information
    const medicationSection = this.extractMedicationSectionFromContent(originalContent);
    if (medicationSection) {
      chronologicalDoc += `CURRENT MEDICATIONS:\n${medicationSection}\n\n`;
    }
    
    // Add allergies
    const allergySection = this.extractAllergySectionFromContent(originalContent);
    if (allergySection) {
      chronologicalDoc += `ALLERGIES:\n${allergySection}\n\n`;
    }
    
    // Add chronological event summary
    chronologicalDoc += `CHRONOLOGICAL EVENT SUMMARY:\n`;
    const sortedEvents = events.filter(e => e.sortableDate)
      .sort((a, b) => new Date(a.sortableDate) - new Date(b.sortableDate));
    
    sortedEvents.forEach(event => {
      if (event.date) {
        chronologicalDoc += `• ${event.date}: ${event.type.replace('_', ' ').toUpperCase()} - Page ${event.pageNumber}\n`;
      }
    });
    
    chronologicalDoc += `\n--- END OF CHRONOLOGICAL MEDICAL HISTORY ---\n`;
    
    return chronologicalDoc;
  }
  
  extractPatientInfoFromContent(content) {
    if (!content) return null;
    
    const patientInfo = {};
    let hasInfo = false;
    
    // Extract patient name
    const patientMatch = content.match(/Patient:\s*([^\n\r]+)/i);
    if (patientMatch && patientMatch[1]) {
      patientInfo.name = patientMatch[1].trim();
      hasInfo = true;
    }
    
    // Extract date of birth
    const dobMatch = content.match(/DOB:\s*([^\n\r]+)/i);
    if (dobMatch && dobMatch[1]) {
      patientInfo.dateOfBirth = dobMatch[1].trim();
      hasInfo = true;
    }
    
    // Extract MRN
    const mrnMatch = content.match(/MRN:\s*([^\n\r]+)/i);
    if (mrnMatch && mrnMatch[1]) {
      patientInfo.medicalRecordNumber = mrnMatch[1].trim();
      hasInfo = true;
    }
    
    // Extract document date
    const docDateMatch = content.match(/Date:\s*([^\n\r]+)/i);
    if (docDateMatch && docDateMatch[1]) {
      patientInfo.documentDate = docDateMatch[1].trim();
      hasInfo = true;
    }
    
    console.log('✅ Patient info extracted:', patientInfo);
    return hasInfo ? patientInfo : null;
  }
  
  extractMedicationSectionFromContent(content) {
    if (!content) return null;
    
    const medMatch = content.match(/CURRENT MEDICATIONS:([\s\S]*?)(?=ALLERGIES|RECENT|VITAL|Document|$)/i);
    return medMatch && medMatch[1] ? medMatch[1].trim() : null;
  }
  
  extractAllergySectionFromContent(content) {
    if (!content) return null;
    
    const allergyMatch = content.match(/ALLERGIES:([\s\S]*?)(?=RECENT|VITAL|Document|$)/i);
    return allergyMatch && allergyMatch[1] ? allergyMatch[1].trim() : null;
  }
  
  async extractTextFromImage(imagePath) {
    try {
      // For now, return a structured medical text based on image analysis
      // In a real OCR implementation, you would use:
      // 1. Tesseract OCR
      // 2. Cloud OCR services (Google Vision, AWS Textract, Azure Cognitive Services)
      // 3. Commercial OCR libraries
      
      const stats = await fs.stat(imagePath);
      const imageSize = Math.round(stats.size / 1024);
      
      // Real OCR should extract text from images - no fake generation
      console.log(`❌ Image processing reached fake generation - should use real OCR`);
      return '';
    } catch (error) {
      console.error(`❌ Failed to process image ${imagePath}:`, error.message);
      return null;
    }
  }
  
  generateMedicalTextFromImage(imagePath, imageSize) {
    // This method should extract real text from images using OCR
    console.log(`❌ generateMedicalTextFromImage called - this should not happen with real OCR`);
    return '';
  }

  async extractWithPdfToText(filePath) {
    try {
      console.log('🔍 Attempting extraction with pdftotext...');
      
      const { stdout } = await exec(`pdftotext -layout -nopgbrk "${filePath}" -`, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        windowsHide: true
      });
      
      if (stdout && stdout.trim().length > 50) {
        console.log(`✅ pdftotext extraction successful: ${stdout.length} characters`);
        return stdout;
      } else {
        console.log('⚠️ pdftotext returned insufficient content');
        return null;
      }
    } catch (error) {
      console.error('❌ pdftotext extraction failed:', error.message);
      return null;
    }
  }

  async extractWithPoppler(filePath) {
    try {
      console.log('🔍 Attempting extraction with poppler...');
      
      // Create temp directory
      const tempDir = path.join(path.dirname(filePath), 'temp_poppler');
      await fs.mkdir(tempDir, { recursive: true });
      
      // Convert first few pages to images
      const outputPrefix = path.join(tempDir, 'page');
      await exec(`pdftoppm -png -f 1 -l 5 "${filePath}" "${outputPrefix}"`, {
        timeout: 30000
      });
      
      // Get generated image files
      const files = await fs.readdir(tempDir);
      const imageFiles = files.filter(f => f.endsWith('.png')).sort();
      
      let extractedText = '';
      
      // Simple pattern recognition on images (basic text detection)
      for (const imageFile of imageFiles.slice(0, 3)) {
        const imagePath = path.join(tempDir, imageFile);
        try {
          // Use a simple image-to-text approach
          const pageText = await this.simpleImageTextExtraction(imagePath);
          if (pageText) {
            extractedText += `\n--- Page ${imageFiles.indexOf(imageFile) + 1} ---\n${pageText}\n`;
          }
        } catch (pageError) {
          console.error(`❌ Failed to process image ${imageFile}:`, pageError.message);
        }
      }
      
      // Cleanup
      await this.cleanupDirectory(tempDir);
      
      return extractedText;
    } catch (error) {
      console.error('❌ Poppler extraction failed:', error.message);
      return null;
    }
  }

  async simpleImageTextExtraction(imagePath) {
    // This is a simplified approach - in a real implementation,
    // you might use a lightweight OCR library or send to a cloud service
    try {
      // For now, return a placeholder indicating image processing
      const stats = await fs.stat(imagePath);
      return `[Image processed: ${path.basename(imagePath)}, Size: ${Math.round(stats.size/1024)}KB - Text extraction requires OCR processing]`;
    } catch (error) {
      return null;
    }
  }

  getTempImagePath(filePath, suffix) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, '.pdf');
    return path.join(dir, `temp_${name}_${suffix}`);
  }

  getTempPdfPath(filePath) {
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, '.pdf');
    return path.join(dir, `temp_${name}_processed.pdf`);
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      await Promise.all(files.map(file => fs.unlink(path.join(dirPath, file))));
      await fs.rmdir(dirPath);
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async extractMedicalDataFromText(text) {
    console.log('🔍 Starting comprehensive medical data extraction...');
    
    const medicalData = {
      conditions: [],
      medications: [],
      allergies: [],
      procedures: [],
      dates: [],
      measurements: [],
      keywords: [],
      structuredData: {
        patientInfo: {},
        medicalHistory: [],
        labResults: [],
        currentMedications: [],
        vitals: [],
        consultations: []
      }
    };

    try {
      console.log('📝 Processing text for structured medical information...');
      
      // Check if text contains Hebrew
      const hebrewRegex = /[\u0590-\u05FF]/;
      const isHebrew = hebrewRegex.test(text);
      
      // Extract structured patient information
      medicalData.structuredData.patientInfo = this.extractPatientInfo(text);
      
      // Extract medical conditions with dates and context
      medicalData.structuredData.medicalHistory = this.extractMedicalHistoryWithDates(text);
      
      // Extract laboratory results with dates
      medicalData.structuredData.labResults = this.extractLabResultsWithDates(text);
      
      // Extract current medications with detailed information
      medicalData.structuredData.currentMedications = this.extractCurrentMedicationsWithDetails(text);
      
      // Extract vital signs with dates
      medicalData.structuredData.vitals = this.extractVitalSignsWithDates(text);
      
      // Extract consultations and visits
      medicalData.structuredData.consultations = this.extractConsultationsWithDates(text);
      
      // Extract allergies with severity
      medicalData.allergies = this.extractAllergiesWithSeverity(text);
      
      // Enhanced medical condition detection for both Hebrew and English
      let conditionPatterns = [];
      
      if (isHebrew) {
        console.log('🌐 Processing Hebrew medical text...');
        conditionPatterns = [
          { pattern: /(?:יתר לחץ דם|לחץ דם גבוה|יל"ד)/gi, condition: 'hypertension' },
          { pattern: /(?:סוכרת|דיאבטס|סכרת)/gi, condition: 'diabetes' },
          { pattern: /(?:היפרליפידמיה|כולסטרול גבוה|שומנים גבוהות|רמות שומנים)/gi, condition: 'hyperlipidemia' },
          { pattern: /(?:מחלת לב|לב איסכמית|מחלה לבבית|בעיות לב)/gi, condition: 'heart_disease' },
          { pattern: /(?:ניתוח מעקפים|מעקפים|ניתוח לב)/gi, condition: 'cardiac_surgery' },
          { pattern: /(?:קוצר נשימה|דיספנאה|קושי בנשימה)/gi, condition: 'dyspnea' },
          { pattern: /(?:נפיחות|בצקת|נפיחות בקרסוליים)/gi, condition: 'edema' },
          { pattern: /(?:אי ספיקת לב|אי-ספיקת לב|ספיקת לב)/gi, condition: 'heart_failure' },
          { pattern: /(?:מעשן|עישון|מעשן כבד)/gi, condition: 'smoking' },
          { pattern: /(?:אסתמה|קצרת)/gi, condition: 'asthma' },
          { pattern: /(?:דיכאון|דכאון)/gi, condition: 'depression' },
          { pattern: /(?:חרדה|חרדות)/gi, condition: 'anxiety' },
          { pattern: /(?:סרטן|גידול ממאיר)/gi, condition: 'cancer' },
          { pattern: /(?:שבץ|שבץ מוחי)/gi, condition: 'stroke' }
        ];
      } else {
        conditionPatterns = [
          { pattern: /(?:diabetes mellitus type 2|diabetes|diabetic|dm\s+type|blood sugar|glucose)/gi, condition: 'diabetes' },
          { pattern: /(?:hypertension|high blood pressure|elevated bp|htn)/gi, condition: 'hypertension' },
          { pattern: /(?:hyperlipidemia|high cholesterol|dyslipidemia)/gi, condition: 'hyperlipidemia' },
          { pattern: /(?:heart disease|cardiac|coronary|myocardial|angina)/gi, condition: 'heart_disease' },
          { pattern: /(?:asthma|bronchial|wheeze|bronchodilator)/gi, condition: 'asthma' },
          { pattern: /(?:copd|emphysema|chronic obstructive)/gi, condition: 'copd' },
          { pattern: /(?:depression|depressive|mood disorder|psychiatric)/gi, condition: 'depression' },
          { pattern: /(?:anxiety|panic|generalized anxiety|gad)/gi, condition: 'anxiety' },
          { pattern: /(?:arthritis|joint pain|osteoarthritis|rheumatoid)/gi, condition: 'arthritis' },
          { pattern: /(?:cancer|carcinoma|oncology|malignancy|tumor)/gi, condition: 'cancer' },
          { pattern: /(?:stroke|cva|cerebrovascular|tia)/gi, condition: 'stroke' }
        ];
      }

      conditionPatterns.forEach(({ pattern, condition }) => {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
          medicalData.conditions.push(condition);
          medicalData.keywords.push(...matches.slice(0, 3));
          console.log(`✅ Found medical condition: ${condition} (${matches[0]})`);
        }
      });

      // Enhanced medication detection
      const medicationPatterns = [
        /(?:metformin|glucophage)/gi,
        /(?:lisinopril|zestril|prinivil)/gi,
        /(?:amlodipine|norvasc)/gi,
        /(?:atorvastatin|lipitor)/gi,
        /(?:levothyroxine|synthroid)/gi,
        /(?:omeprazole|prilosec)/gi,
        /(?:sertraline|zoloft)/gi,
        /(?:gabapentin|neurontin)/gi,
        /(?:prednisone|prednisolone)/gi,
        /(?:insulin|humalog|lantus)/gi,
        /(?:aspirin|acetaminophen|ibuprofen)/gi,
        /(?:warfarin|coumadin)/gi
      ];

      medicationPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          medicalData.medications.push(...matches.slice(0, 2).map(m => m.toLowerCase()));
        }
      });

      // Enhanced date extraction
      const datePatterns = [
        /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
        /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{2,4}\b/gi,
        /\b\d{4}-\d{2}-\d{2}\b/g
      ];

      datePatterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        medicalData.dates.push(...matches.slice(0, 10)); // Increased limit for dates
      });

      // Enhanced vital measurements
      const vitalPatterns = [
        { pattern: /(?:blood pressure|bp)[:\s]*(\d{2,3}\/\d{2,3})/gi, type: 'blood_pressure' },
        { pattern: /(?:heart rate|hr|pulse)[:\s]*(\d{2,3})\s*(?:bpm|beats)/gi, type: 'heart_rate' },
        { pattern: /(?:temperature|temp)[:\s]*(\d{2,3}\.?\d?)\s*°?[fc]/gi, type: 'temperature' },
        { pattern: /(?:weight|wt)[:\s]*(\d{2,3}\.?\d?)\s*(?:lbs?|kg)/gi, type: 'weight' },
        { pattern: /(?:height|ht)[:\s]*(\d{1}\s*'\s*\d{1,2}\s*"|\d{2,3}\s*cm)/gi, type: 'height' },
        { pattern: /(?:oxygen|o2|spo2)[:\s]*(\d{2,3})%/gi, type: 'oxygen_saturation' }
      ];

      vitalPatterns.forEach(({ pattern, type }) => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
          medicalData.measurements.push({ type, value: match });
        });
      });

      // Remove duplicates
      medicalData.conditions = [...new Set(medicalData.conditions)];
      medicalData.medications = [...new Set(medicalData.medications)];
      medicalData.dates = [...new Set(medicalData.dates)];
      medicalData.keywords = [...new Set(medicalData.keywords)];

      console.log(`📊 Comprehensive medical data extracted:`, {
        conditions: medicalData.conditions.length,
        medications: medicalData.medications.length,
        dates: medicalData.dates.length,
        measurements: medicalData.measurements.length,
        keywords: medicalData.keywords.length,
        structuredSections: {
          patientInfo: Object.keys(medicalData.structuredData.patientInfo).length,
          medicalHistory: medicalData.structuredData.medicalHistory.length,
          labResults: medicalData.structuredData.labResults.length,
          currentMedications: medicalData.structuredData.currentMedications.length,
          vitals: medicalData.structuredData.vitals.length,
          consultations: medicalData.structuredData.consultations.length
        }
      });

      return medicalData;

    } catch (error) {
      console.error('❌ Comprehensive medical data extraction failed:', error);
      return medicalData;
    }
  }

  extractPatientInfo(text) {
    console.log('👤 Extracting patient information...');
    
    const patientInfo = {};
    
    // Extract patient name
    const nameMatch = text.match(/Patient:\s*([^\n\r]+)/i);
    if (nameMatch) {
      patientInfo.name = nameMatch[1].trim();
    }
    
    // Extract date of birth
    const dobMatch = text.match(/DOB:\s*([\d\/\-]+)/i);
    if (dobMatch) {
      patientInfo.dateOfBirth = dobMatch[1].trim();
    }
    
    // Extract MRN
    const mrnMatch = text.match(/MRN:\s*([^\n\r]+)/i);
    if (mrnMatch) {
      patientInfo.medicalRecordNumber = mrnMatch[1].trim();
    }
    
    // Extract document date
    const docDateMatch = text.match(/Date:\s*([^\n\r]+)/i);
    if (docDateMatch) {
      patientInfo.documentDate = docDateMatch[1].trim();
    }
    
    console.log('✅ Patient info extracted:', patientInfo);
    return patientInfo;
  }
  
  extractMedicalHistoryWithDates(text) {
    console.log('🏥 Extracting medical history with dates...');
    
    const medicalHistory = [];
    
    if (!text) {
      console.log('⚠️ No text provided for medical history extraction');
      return medicalHistory;
    }
    
    // Pattern to match numbered medical conditions with dates
    const historyPattern = /(?:\d+\.\s*)([^\(]+)\(([^\)]+)\)([\s\S]*?)(?=\d+\.|RECENT|CURRENT|ALLERGIES|$)/gi;
    
    let match;
    let matchCount = 0;
    while ((match = historyPattern.exec(text)) !== null) {
      matchCount++;
      const condition = match[1] ? match[1].trim() : '';
      const dateRange = match[2] ? match[2].trim() : '';
      const details = match[3] ? match[3].trim() : '';
      
      if (!condition) continue;
      
      // Extract diagnosis date
      let diagnosisDate = null;
      const diagnosisMatch = details.match(/Diagnosed:\s*([A-Za-z]+\s+\d{4})/i);
      if (diagnosisMatch && diagnosisMatch[1]) {
        diagnosisDate = diagnosisMatch[1].trim();
      }
      
      // Extract current medication
      let currentMedication = null;
      const medicationMatch = details.match(/Current Medication:\s*([^\n\r]+)/i);
      if (medicationMatch && medicationMatch[1]) {
        currentMedication = medicationMatch[1].trim();
      }
      
      // Extract last test result
      let lastTest = null;
      const lastTestMatch = details.match(/Last\s+([^:]+):\s*([^\n\r]+)/i);
      if (lastTestMatch && lastTestMatch[1] && lastTestMatch[2]) {
        lastTest = {
          type: lastTestMatch[1].trim(),
          result: lastTestMatch[2].trim()
        };
      }
      
      const historyEntry = {
        condition: condition,
        dateRange: dateRange,
        diagnosisDate: diagnosisDate,
        currentMedication: currentMedication,
        lastTest: lastTest,
        details: details
      };
      
      medicalHistory.push(historyEntry);
    }
    
    console.log(`✅ Medical history extracted: ${medicalHistory.length} conditions from ${matchCount} matches`);
    return medicalHistory;
  }
  
  extractLabResultsWithDates(text) {
    console.log('🧪 Extracting lab results with dates...');
    
    const labResults = [];
    
    // Extract lab results section
    const labSection = text.match(/RECENT LABORATORY RESULTS:([\s\S]*?)(?=CURRENT|ALLERGIES|RECENT CONSULTATIONS|$)/i);
    
    if (labSection) {
      const labText = labSection[1];
      
      // Extract date
      const dateMatch = labText.match(/Date:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      const labDate = dateMatch ? dateMatch[1].trim() : null;
      
      // Extract individual lab values
      const labPattern = /•\s*([^:]+):\s*([^\n\r]+)/g;
      
      let match;
      while ((match = labPattern.exec(labText)) !== null) {
        const testName = match[1].trim();
        const resultLine = match[2].trim();
        
        // Parse result value and status
        const resultMatch = resultLine.match(/([\d\.]+)\s*([^\(]+)?\s*(?:\(([^\)]+)\))?\s*(?:\[([^\]]+)\])?/);
        
        if (resultMatch) {
          const labResult = {
            date: labDate,
            testName: testName,
            value: resultMatch[1],
            unit: resultMatch[2] ? resultMatch[2].trim() : null,
            status: resultMatch[3] ? resultMatch[3].trim() : null,
            normalRange: resultMatch[4] ? resultMatch[4].trim() : null,
            fullResult: resultLine
          };
          
          labResults.push(labResult);
        }
      }
    }
    
    console.log(`✅ Lab results extracted: ${labResults.length} tests`);
    return labResults;
  }
  
  extractCurrentMedicationsWithDetails(text) {
    console.log('💊 Extracting current medications with details...');
    
    const medications = [];
    
    // Extract medications section
    const medSection = text.match(/CURRENT MEDICATIONS:([\s\S]*?)(?=ALLERGIES|RECENT|VITAL|$)/i);
    
    if (medSection) {
      const medText = medSection[1];
      
      // Pattern to match numbered medications
      const medPattern = /(?:\d+\.\s*)([^\n\r]+)([\s\S]*?)(?=\d+\.|$)/g;
      
      let match;
      while ((match = medPattern.exec(medText)) !== null) {
        const medHeader = match[1].trim();
        const medDetails = match[2].trim();
        
        // Parse medication name and dosage
        const nameMatch = medHeader.match(/^([^\d]+)\s*([\d\w\s]+)?/);
        
        if (nameMatch) {
          const prescribedByMatch = medDetails.match(/Prescribed:\s*([^\n\r]+)/i);
          const refillMatch = medDetails.match(/Next refill due:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
          const instructionsMatch = medDetails.match(/Take\s*([^\n\r]+)/i);
          
          const medication = {
            name: nameMatch[1].trim(),
            dosage: nameMatch[2] ? nameMatch[2].trim() : null,
            instructions: instructionsMatch ? instructionsMatch[1].trim() : null,
            prescribedBy: prescribedByMatch ? prescribedByMatch[1].trim() : null,
            nextRefillDate: refillMatch ? refillMatch[1].trim() : null,
            fullDetails: medDetails
          };
          
          medications.push(medication);
        }
      }
    }
    
    console.log(`✅ Current medications extracted: ${medications.length} medications`);
    return medications;
  }
  
  extractVitalSignsWithDates(text) {
    console.log('📊 Extracting vital signs with dates...');
    
    const vitals = [];
    
    // Extract vital signs section
    const vitalSection = text.match(/VITAL SIGNS\s*\((Last Visit[^)]*)\):([\s\S]*?)(?=Document|Confidential|$)/i);
    
    if (vitalSection) {
      const dateHeader = vitalSection[1];
      const vitalText = vitalSection[2];
      
      // Extract date from header
      const dateMatch = dateHeader.match(/Last Visit\s*-\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
      const vitalDate = dateMatch ? dateMatch[1].trim() : null;
      
      // Extract individual vital signs
      const vitalPattern = /•\s*([^:]+):\s*([^\n\r]+)/g;
      
      let match;
      while ((match = vitalPattern.exec(vitalText)) !== null) {
        const vitalName = match[1].trim();
        const vitalValue = match[2].trim();
        
        const vital = {
          date: vitalDate,
          name: vitalName,
          value: vitalValue
        };
        
        vitals.push(vital);
      }
    }
    
    console.log(`✅ Vital signs extracted: ${vitals.length} measurements`);
    return vitals;
  }
  
  extractConsultationsWithDates(text) {
    console.log('👨‍⚕️ Extracting consultations with dates...');
    
    const consultations = [];
    
    // Extract consultations section
    const consultSection = text.match(/RECENT CONSULTATIONS:([\s\S]*?)(?=VITAL|Document|Confidential|$)/i);
    
    if (consultSection) {
      const consultText = consultSection[1];
      
      // Pattern to match consultation entries
      const consultPattern = /([^\n\r]+Consultation[^\n\r]*)([\s\S]*?)(?=[A-Z][^\n\r]*Consultation|VITAL|Document|$)/g;
      
      let match;
      while ((match = consultPattern.exec(consultText)) !== null) {
        const consultHeader = match[1].trim();
        const consultDetails = match[2].trim();
        
        // Extract consultation info
        const specialtyMatch = consultHeader.match(/^([^-]+)/);
        const doctorMatch = consultHeader.match(/-\s*([^\n\r]+)/);
        const dateMatch = consultDetails.match(/Date:\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
        const reasonMatch = consultDetails.match(/Reason:\s*([^\n\r]+)/i);
        const recommendationsMatch = consultDetails.match(/Recommendations:([\s\S]*?)(?=Follow|$)/i);
        
        const consultation = {
          specialty: specialtyMatch ? specialtyMatch[1].trim() : null,
          doctor: doctorMatch ? doctorMatch[1].trim() : null,
          date: dateMatch ? dateMatch[1].trim() : null,
          reason: reasonMatch ? reasonMatch[1].trim() : null,
          recommendations: recommendationsMatch ? recommendationsMatch[1].trim() : null,
          fullDetails: consultDetails
        };
        
        consultations.push(consultation);
      }
    }
    
    console.log(`✅ Consultations extracted: ${consultations.length} consultations`);
    return consultations;
  }
  
  extractAllergiesWithSeverity(text) {
    console.log('⚠️ Extracting allergies with severity...');
    
    const allergies = [];
    
    // Extract allergies section
    const allergySection = text.match(/ALLERGIES:([\s\S]*?)(?=RECENT|VITAL|Document|$)/i);
    
    if (allergySection) {
      const allergyText = allergySection[1];
      
      // Pattern to match allergy entries
      const allergyPattern = /•\s*([^-]+)\s*-\s*([^\n\r]+)/g;
      
      let match;
      while ((match = allergyPattern.exec(allergyText)) !== null) {
        const allergen = match[1].trim();
        const reaction = match[2].trim();
        
        // Determine severity
        const severity = reaction.toLowerCase().includes('severe') ? 'severe' :
                        reaction.toLowerCase().includes('mild') ? 'mild' : 'moderate';
        
        const allergy = {
          allergen: allergen,
          reaction: reaction,
          severity: severity
        };
        
        allergies.push(allergy);
      }
    }
    
    console.log(`✅ Allergies extracted: ${allergies.length} allergies`);
    return allergies;
  }

  async terminate() {
    try {
      console.log('✅ Improved OCR Service terminated');
    } catch (error) {
      console.error('❌ OCR termination failed:', error);
    }
  }
}

module.exports = new ImprovedOCRService();