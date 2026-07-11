# Task 1.1: Enhance OCR Accuracy

## 🔍 **CORE FUNCTIONALITY TASK**
**Phase:** 1 (Core Document Processing)  
**Time Estimate:** 25 minutes  
**Risk Level:** MEDIUM  
**Priority:** HIGH  

## 🎯 **Objective**
Enhance OCR accuracy for medical documents through preprocessing, multi-engine support, and confidence scoring.

## 📈 **Current State**
- Basic Tesseract OCR implementation
- ~75% accuracy on medical documents
- No preprocessing optimization
- Single OCR engine dependency
- No confidence metrics

## 💊 **Target Improvements**
- 95%+ accuracy on medical documents
- Multi-engine OCR with fallbacks
- Intelligent preprocessing
- Confidence scoring and quality assessment
- Medical terminology optimization

## 📁 **Files to Modify**
- `backend/services/enhancedOcrService.js` (create new)
- `backend/services/documentAnalysisService.js`
- `backend/utils/imagePreprocessing.js` (create new)
- `backend/config/ocrEngines.js` (create new)

## 🔧 **Implementation**

### **Step 1: Create Enhanced OCR Service**
```javascript
// backend/services/enhancedOcrService.js
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { GoogleVision } = require('@google-cloud/vision');

class EnhancedOcrService {
  constructor() {
    this.engines = {
      tesseract: this.initTesseract(),
      googleVision: process.env.GOOGLE_VISION_API_KEY ? new GoogleVision() : null,
      azureVision: process.env.AZURE_VISION_API_KEY ? this.initAzureVision() : null
    };
    
    this.medicalTerms = this.loadMedicalTerms();
    this.confidenceThreshold = 0.75;
  }

  async initTesseract() {
    const worker = await Tesseract.createWorker({
      logger: m => console.log('OCR Progress:', m)
    });
    
    await worker.loadLanguage('eng+heb'); // English + Hebrew
    await worker.initialize('eng+heb');
    
    // Optimize for medical documents
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:()/-+*= אבגדהוזחטיךכלםמןנסעףפץצקרשת',
      tessedit_pageseg_mode: '6', // Assume uniform block of text
      preserve_interword_spaces: '1'
    });
    
    return worker;
  }

  async preprocessImage(imageBuffer) {
    try {
      // Multi-stage preprocessing for better OCR
      const processed = await sharp(imageBuffer)
        .resize({ width: 2000, height: 2000, fit: 'inside' }) // Increase resolution
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen text
        .threshold(128) // Binary threshold
        .png() // Convert to PNG for better quality
        .toBuffer();
        
      return processed;
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      return imageBuffer; // Return original if preprocessing fails
    }
  }

  async performTesseractOCR(imageBuffer) {
    try {
      const worker = await this.engines.tesseract;
      
      // Preprocess image
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Perform OCR
      const result = await worker.recognize(processedImage);
      
      return {
        engine: 'tesseract',
        text: result.data.text,
        confidence: result.data.confidence / 100, // Convert to 0-1 scale
        words: result.data.words?.map(word => ({
          text: word.text,
          confidence: word.confidence / 100,
          bbox: word.bbox
        })) || [],
        lines: result.data.lines?.map(line => ({
          text: line.text,
          confidence: line.confidence / 100,
          bbox: line.bbox
        })) || []
      };
    } catch (error) {
      console.error('Tesseract OCR failed:', error);
      return {
        engine: 'tesseract',
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  async performGoogleVisionOCR(imageBuffer) {
    if (!this.engines.googleVision) {
      return { engine: 'google-vision', error: 'Google Vision not configured' };
    }

    try {
      const [result] = await this.engines.googleVision.textDetection({
        image: { content: imageBuffer }
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return {
          engine: 'google-vision',
          text: '',
          confidence: 0
        };
      }

      const fullText = detections[0].description;
      const confidence = this.calculateGoogleVisionConfidence(detections);

      return {
        engine: 'google-vision',
        text: fullText,
        confidence,
        words: detections.slice(1).map(detection => ({
          text: detection.description,
          confidence: 0.9, // Google Vision doesn't provide word-level confidence
          bbox: detection.boundingPoly
        }))
      };
    } catch (error) {
      console.error('Google Vision OCR failed:', error);
      return {
        engine: 'google-vision',
        text: '',
        confidence: 0,
        error: error.message
      };
    }
  }

  async performMultiEngineOCR(imageBuffer) {
    const results = [];
    
    // Try all available engines in parallel
    const promises = [
      this.performTesseractOCR(imageBuffer),
      this.performGoogleVisionOCR(imageBuffer)
    ];

    const ocrResults = await Promise.allSettled(promises);
    
    for (const result of ocrResults) {
      if (result.status === 'fulfilled' && result.value.confidence > 0) {
        results.push(result.value);
      }
    }

    // Sort by confidence and select best result
    results.sort((a, b) => b.confidence - a.confidence);
    
    if (results.length === 0) {
      return {
        text: '',
        confidence: 0,
        engine: 'none',
        error: 'All OCR engines failed'
      };
    }

    const bestResult = results[0];
    
    // If confidence is low, try text combination from multiple engines
    if (bestResult.confidence < this.confidenceThreshold && results.length > 1) {
      const combinedResult = await this.combineOcrResults(results);
      if (combinedResult.confidence > bestResult.confidence) {
        return combinedResult;
      }
    }

    return bestResult;
  }

  async combineOcrResults(results) {
    // Smart combination of OCR results from multiple engines
    const texts = results.map(r => r.text).filter(t => t.length > 0);
    
    if (texts.length === 0) return { text: '', confidence: 0 };
    if (texts.length === 1) return results[0];

    // Simple approach: use longest text with medical term validation
    let bestText = texts.reduce((a, b) => a.length > b.length ? a : b);
    
    // Validate with medical terms
    const medicalScore = this.calculateMedicalTermScore(bestText);
    
    return {
      engine: 'multi-engine',
      text: bestText,
      confidence: Math.min(0.9, results[0].confidence + 0.1), // Slight boost for combination
      medicalScore,
      sourceEngines: results.map(r => r.engine)
    };
  }

  calculateMedicalTermScore(text) {
    const words = text.toLowerCase().split(/\s+/);
    const medicalTermCount = words.filter(word => 
      this.medicalTerms.some(term => 
        term.toLowerCase().includes(word) || word.includes(term.toLowerCase())
      )
    ).length;
    
    return medicalTermCount / words.length;
  }

  loadMedicalTerms() {
    // Common medical terms for validation
    return [
      // Lab terms
      'glucose', 'cholesterol', 'hemoglobin', 'creatinine', 'sodium', 'potassium',
      'white blood cells', 'red blood cells', 'platelet', 'hematocrit',
      // Medical conditions
      'diabetes', 'hypertension', 'pneumonia', 'bronchitis', 'asthma',
      // Medications
      'aspirin', 'paracetamol', 'amoxicillin', 'ibuprofen', 'metformin',
      // Hebrew terms
      'גלוקוז', 'כולסטרול', 'המוגלובין', 'משקע', 'דם'
    ];
  }

  async analyzeOcrQuality(ocrResult) {
    const quality = {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text?.length || 0,
      wordCount: ocrResult.text?.split(/\s+/).length || 0,
      medicalScore: this.calculateMedicalTermScore(ocrResult.text || ''),
      hasStructuredData: this.detectStructuredData(ocrResult.text || ''),
      recommendation: 'unknown'
    };

    // Determine recommendation
    if (quality.confidence > 0.9 && quality.medicalScore > 0.1) {
      quality.recommendation = 'excellent';
    } else if (quality.confidence > 0.75) {
      quality.recommendation = 'good';
    } else if (quality.confidence > 0.5) {
      quality.recommendation = 'review_needed';
    } else {
      quality.recommendation = 'manual_review_required';
    }

    return quality;
  }

  detectStructuredData(text) {
    // Detect common medical document structures
    const patterns = [
      /\d+\.\d+\s*(mg\/dl|mmol\/l|g\/dl)/i, // Lab values
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // Dates
      /\d{2}:\d{2}/g, // Times
      /[A-Z]{2,}\s*:\s*.+/g // Field labels
    ];

    return patterns.some(pattern => pattern.test(text));
  }
}

module.exports = EnhancedOcrService;
```

### **Step 2: Update Document Analysis Service**
```javascript
// In backend/services/documentAnalysisService.js
const EnhancedOcrService = require('./enhancedOcrService');

class DocumentAnalysisService {
  constructor() {
    this.ocrService = new EnhancedOcrService();
  }

  async analyzeDocument(documentBuffer, documentType) {
    try {
      // Determine if OCR is needed
      const needsOcr = this.requiresOcr(documentBuffer, documentType);
      
      if (!needsOcr) {
        return await this.analyzeTextDocument(documentBuffer);
      }

      // Perform enhanced OCR
      const ocrResult = await this.ocrService.performMultiEngineOCR(documentBuffer);
      
      // Analyze OCR quality
      const quality = await this.ocrService.analyzeOcrQuality(ocrResult);
      
      // Extract structured data based on OCR results
      const structuredData = await this.extractStructuredData(ocrResult.text, quality);
      
      return {
        success: true,
        ocr: {
          text: ocrResult.text,
          engine: ocrResult.engine,
          confidence: ocrResult.confidence,
          quality
        },
        extracted: structuredData,
        requiresReview: quality.recommendation === 'manual_review_required'
      };
      
    } catch (error) {
      console.error('Document analysis failed:', error);
      return {
        success: false,
        error: error.message,
        requiresReview: true
      };
    }
  }

  requiresOcr(buffer, documentType) {
    // Check if document is an image or PDF that needs OCR
    const imageTypes = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
    return imageTypes.includes(documentType);
  }

  async extractStructuredData(text, quality) {
    // Extract structured data based on quality and content
    if (quality.medicalScore > 0.1) {
      return await this.extractMedicalData(text);
    } else {
      return await this.extractGeneralData(text);
    }
  }
}
```

## 🧪 **Testing**
1. **Accuracy testing:** Compare against ground truth documents
2. **Multi-engine fallback:** Test with corrupted images
3. **Medical terms:** Verify medical terminology detection
4. **Performance:** Measure processing time improvements
5. **Confidence scoring:** Validate confidence correlates with accuracy

## ✅ **Success Criteria**
- [ ] OCR accuracy ≥95% on medical documents
- [ ] Multi-engine fallback working
- [ ] Confidence scoring implemented
- [ ] Medical term validation functional
- [ ] Processing time <30 seconds per document
- [ ] Hebrew text recognition working

## 🔄 **Next Task**
Proceed to: **Task 1.2:** Add Multi-Language OCR

## 📝 **Performance Notes**
- Consider GPU acceleration for large batches
- Implement result caching for identical documents
- Monitor memory usage with large images
- Set up regular accuracy benchmarking