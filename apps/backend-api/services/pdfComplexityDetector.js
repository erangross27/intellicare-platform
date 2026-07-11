/**
 * PDF Complexity Detector and Converter
 *
 * Analyzes PDFs to determine visual complexity (tables, images, formatting)
 * Automatically converts complex PDFs to plain text for better Claude extraction
 *
 * Created: November 2025
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
// Using pdftotext (poppler-utils) exclusively for PDF text extraction
// pdf-parse npm package removed - pdftotext is more reliable

class PDFComplexityDetector {
  constructor() {
    // Complexity thresholds
    this.SIZE_THRESHOLD_KB = 150;  // PDFs > 150KB are likely complex
    this.SIZE_TO_TEXT_RATIO = 15;  // If file size / text chars > 15, it's image/table heavy
  }

  /**
   * Detect if a PDF is complex based on file size and content analysis
   *
   * @param {Buffer|string} pdfContent - PDF content as Buffer or base64 string
   * @returns {object} { isComplex: boolean, reason: string, metrics: object }
   */
  async detectComplexity(pdfContent) {
    try {
      // Convert base64 to Buffer if needed
      let pdfBuffer;
      if (typeof pdfContent === 'string') {
        // Remove data URL prefix if present
        const base64Data = pdfContent.replace(/^data:application\/pdf;base64,/, '');
        pdfBuffer = Buffer.from(base64Data, 'base64');
      } else {
        pdfBuffer = pdfContent;
      }

      // Metric 1: File size in KB
      const fileSizeKB = pdfBuffer.length / 1024;

      // Metric 2: Extract text to analyze size-to-text ratio
      const extractedText = await this.extractTextFromBuffer(pdfBuffer);
      const textChars = extractedText.length;
      const sizeToTextRatio = textChars > 0 ? fileSizeKB / (textChars / 1024) : 999;

      // Metric 3: Check for PDF objects that indicate complexity
      const pdfString = pdfBuffer.toString('latin1');
      const imageCount = (pdfString.match(/\/Image/g) || []).length;
      const formCount = (pdfString.match(/\/Form/g) || []).length;
      const graphicsStateCount = (pdfString.match(/\/ExtGState/g) || []).length;

      // Calculate complexity score
      const metrics = {
        fileSizeKB: Math.round(fileSizeKB),
        textChars: textChars,
        sizeToTextRatio: Math.round(sizeToTextRatio * 100) / 100,
        imageCount: imageCount,
        formCount: formCount,
        graphicsStateCount: graphicsStateCount
      };

      // Determine if complex based on multiple factors
      let isComplex = false;
      let reason = '';

      if (fileSizeKB > this.SIZE_THRESHOLD_KB && sizeToTextRatio > this.SIZE_TO_TEXT_RATIO) {
        isComplex = true;
        reason = `Large file (${Math.round(fileSizeKB)}KB) with low text content (ratio: ${metrics.sizeToTextRatio})`;
      } else if (imageCount > 10) {
        isComplex = true;
        reason = `High image count (${imageCount} images)`;
      } else if (formCount > 5 && graphicsStateCount > 20) {
        isComplex = true;
        reason = `Complex formatting (${formCount} forms, ${graphicsStateCount} graphics states)`;
      } else if (fileSizeKB > 400) {
        isComplex = true;
        reason = `Very large file (${Math.round(fileSizeKB)}KB)`;
      } else {
        reason = `Simple PDF (${Math.round(fileSizeKB)}KB, ${textChars} chars)`;
      }

      console.log(`📊 PDF Complexity Analysis: ${isComplex ? '❌ COMPLEX' : '✅ SIMPLE'}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Metrics:`, metrics);

      return {
        isComplex: isComplex,
        reason: reason,
        metrics: metrics,
        extractedText: isComplex ? extractedText : null  // Only return text if we'll use it
      };

    } catch (error) {
      console.error('❌ Error detecting PDF complexity:', error.message);
      // Default to treating as simple PDF if detection fails
      return {
        isComplex: false,
        reason: 'Error during detection - defaulting to simple PDF',
        metrics: {},
        error: error.message
      };
    }
  }

  /**
   * Extract text with table structure using pdf-parse
   *
   * @param {Buffer} pdfBuffer - PDF content as Buffer
   * @returns {Promise<string|null>} Extracted text with tables, or null if failed
   */
  async extractTextWithPdfParse(pdfBuffer) {
    // pdf-parse removed - using pdftotext exclusively
    return null;
  }

  /**
   * Extract plain text from PDF buffer using pdftotext
   *
   * @param {Buffer} pdfBuffer - PDF content as Buffer
   * @returns {string} Extracted plain text
   */
  async extractTextFromBuffer(pdfBuffer) {
    // Using pdftotext (poppler-utils) for PDF text extraction
    console.log('🔍 Extracting text with pdftotext...');

    const tempPdfPath = path.join(os.tmpdir(), `temp-${Date.now()}.pdf`);
    const tempTxtPath = path.join(os.tmpdir(), `temp-${Date.now()}.txt`);

    try {
      // Write PDF buffer to temp file
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // Run pdftotext to extract plain text
      // -layout: Maintain original layout as much as possible
      // -nopgbrk: Don't insert page breaks
      execSync(`pdftotext -layout -nopgbrk "${tempPdfPath}" "${tempTxtPath}"`, {
        timeout: 30000,  // 30 second timeout
        stdio: 'ignore'  // Suppress output
      });

      // Read extracted text
      const extractedText = fs.readFileSync(tempTxtPath, 'utf-8');

      // Clean up temp files
      fs.unlinkSync(tempPdfPath);
      fs.unlinkSync(tempTxtPath);

      // Enhance text with structural markers for better Claude extraction
      const enhancedText = this.enhanceTextStructure(extractedText);

      return enhancedText.trim();

    } catch (error) {
      // Clean up temp files on error
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      if (fs.existsSync(tempTxtPath)) fs.unlinkSync(tempTxtPath);

      console.error('❌ Error extracting text from PDF:', error.message);
      return '';  // Return empty string if extraction fails
    }
  }

  /**
   * Enhance extracted text with structural markers to improve Claude extraction
   *
   * This adds clear section delimiters and preserves document structure
   * to help Claude identify which data belongs in which collection
   *
   * @param {string} text - Raw extracted text
   * @returns {string} Enhanced text with structural markers
   */
  enhanceTextStructure(text) {
    if (!text) return '';

    // Common medical document section headers to recognize and enhance
    const sectionHeaders = [
      // Patient/Administrative
      'PATIENT INFORMATION', 'PATIENT DETAILS', 'DEMOGRAPHICS',
      'ATTENDING PHYSICIAN', 'PRIMARY PHYSICIAN', 'PROVIDER INFORMATION',

      // Clinical sections
      'CHIEF COMPLAINT', 'HISTORY OF PRESENT ILLNESS', 'HPI',
      'ADMITTING DIAGNOSIS', 'ADMISSION DIAGNOSIS', 'ADMISSION DIAGNOSES',
      'DISCHARGE DIAGNOSIS', 'DISCHARGE DIAGNOSES', 'FINAL DIAGNOSIS',
      'HOSPITAL COURSE', 'CLINICAL COURSE', 'COURSE IN HOSPITAL',
      'PHYSICAL EXAMINATION', 'PHYSICAL EXAM', 'EXAM',
      'ASSESSMENT', 'ASSESSMENT AND PLAN', 'IMPRESSION',
      'PLAN', 'TREATMENT PLAN', 'CARE PLAN',

      // Procedures/Tests
      'PROCEDURES PERFORMED', 'PROCEDURES', 'OPERATIONS',
      'LABORATORY RESULTS', 'LAB RESULTS', 'LABS', 'LABORATORY DATA',
      'IMAGING RESULTS', 'RADIOLOGY', 'STUDIES',
      'VITAL SIGNS', 'VITALS',

      // Medications
      'MEDICATIONS', 'DISCHARGE MEDICATIONS', 'CURRENT MEDICATIONS',
      'PRESCRIPTIONS', 'MEDICATION LIST',

      // Instructions/Follow-up
      'DISCHARGE INSTRUCTIONS', 'INSTRUCTIONS', 'PATIENT INSTRUCTIONS',
      'FOLLOW-UP', 'FOLLOW UP', 'FOLLOWUP',
      'PATIENT EDUCATION', 'EDUCATION PROVIDED',

      // Other
      'ALLERGIES', 'ADVERSE REACTIONS',
      'SOCIAL HISTORY', 'FAMILY HISTORY', 'PAST MEDICAL HISTORY',
      'RECOMMENDATIONS', 'DISPOSITION', 'CONDITION AT DISCHARGE'
    ];

    let enhancedText = text;

    // Add clear section markers with delimiters
    sectionHeaders.forEach(header => {
      // Match section header at start of line (case-insensitive)
      const regex = new RegExp(`^(${header})\\s*$`, 'gim');

      // Replace with strongly delimited section marker
      enhancedText = enhancedText.replace(regex, (match) => {
        return `\n${'='.repeat(80)}\n[SECTION: ${match.trim()}]\n${'='.repeat(80)}`;
      });
    });

    // Enhance numbered lists to preserve hierarchy
    // Match patterns like "1." or "1)" at start of line
    enhancedText = enhancedText.replace(/^(\s*)(\d+)[.)]\s+/gm, '$1[$2] ');

    // Enhance bulleted lists
    enhancedText = enhancedText.replace(/^(\s*)[•✓✗-]\s+/gm, '$1  * ');

    // Enhance table-like structures (detect multiple spaces that indicate columns)
    const lines = enhancedText.split('\n');
    const enhancedLines = lines.map(line => {
      // If line has multiple segments of 3+ spaces, it's likely a table row
      const segments = line.split(/\s{3,}/);
      if (segments.length > 2 && segments.every(s => s.trim().length > 0)) {
        // Mark as table row with clear column separators
        return segments.map(s => s.trim()).join(' | ');
      }
      return line;
    });

    enhancedText = enhancedLines.join('\n');

    // Add document boundaries
    enhancedText = `${'='.repeat(80)}\n[BEGIN MEDICAL DOCUMENT]\n${'='.repeat(80)}\n\n${enhancedText}\n\n${'='.repeat(80)}\n[END MEDICAL DOCUMENT]\n${'='.repeat(80)}`;

    return enhancedText;
  }

  /**
   * Convert PDF to text format for Claude batch processing
   * Detects complexity and converts to text if needed
   *
   * @param {Buffer|string} pdfContent - PDF content as Buffer or base64 string
   * @param {string} filename - Original filename (for logging)
   * @returns {object} { content: string|Buffer, contentType: string, wasConverted: boolean, complexity: object }
   */
  async prepareDocumentForBatch(pdfContent, filename = 'document.pdf') {
    console.log(`\n🔍 Analyzing PDF complexity: ${filename}`);

    // Detect complexity
    const complexity = await this.detectComplexity(pdfContent);

    if (complexity.isComplex) {
      console.log(`🔄 Converting complex PDF to plain text for better extraction`);

      // Use extracted text from complexity detection (already extracted)
      const plainText = complexity.extractedText;

      if (plainText && plainText.length > 0) {
        console.log(`✅ Converted to plain text: ${plainText.length} characters`);

        return {
          content: plainText,
          contentType: 'text/plain',
          wasConverted: true,
          complexity: complexity
        };
      } else {
        console.warn(`⚠️ Text extraction failed, keeping as PDF`);

        // Convert base64 to Buffer if needed
        let pdfBuffer = typeof pdfContent === 'string'
          ? Buffer.from(pdfContent.replace(/^data:application\/pdf;base64,/, ''), 'base64')
          : pdfContent;

        return {
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
          wasConverted: false,
          complexity: complexity
        };
      }
    } else {
      console.log(`✅ Simple PDF - keeping original format for better formatting`);

      // Convert base64 to Buffer if needed, then back to clean base64
      let pdfBuffer = typeof pdfContent === 'string'
        ? Buffer.from(pdfContent.replace(/^data:application\/pdf;base64,/, ''), 'base64')
        : pdfContent;

      return {
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
        wasConverted: false,
        complexity: complexity
      };
    }
  }

  /**
   * Check if pdftotext is installed on the system
   *
   * @returns {boolean} True if pdftotext is available
   */
  static checkPdfToTextInstalled() {
    try {
      execSync('which pdftotext', { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('❌ pdftotext not found. Install with: sudo apt-get install poppler-utils');
      return false;
    }
  }
}

module.exports = new PDFComplexityDetector();
