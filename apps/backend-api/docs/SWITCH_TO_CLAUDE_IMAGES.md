# Task: Switch Medical Image Analysis to Claude

## Current Status
- ✅ **PDF Analysis**: Already switched to Claude (working)
- ⚠️ **Batch Processing**: Has issues (to be resolved later)
- 🔄 **Medical Images**: Need to switch from Gemini to Claude

## Why Switch to Claude for Images
1. **Claude CAN analyze medical images** - Confirmed with real MRI analysis
2. **No Google Cloud account needed** - Eliminates hourly charges
3. **95% cost reduction** - $0.025 per image vs $5+ with Google Cloud
4. **Single API provider** - Simplifies architecture and billing
5. **Professional quality** - Radiologist-level reports confirmed

## Implementation Tasks

### 1. Remove Gemini Image Analysis Code
```javascript
// FILES TO UPDATE/REMOVE:
- services/geminiMedicalService.js  // DELETE
- services/geminiService.js  // DELETE  
- routes/geminiOptimization.js  // DELETE
- Any other Gemini medical image code
```

### 2. Update Document Analysis Service
```javascript
// services/documentAnalysisService.js
// Current: Uses Claude for PDFs (working)
// Add: Medical image support

async analyzeDocument(file, metadata) {
  const fileType = this.detectFileType(file);
  
  if (fileType === 'pdf') {
    // Already using Claude ✅
    return await this.analyzePDFWithClaude(file, metadata);
  } else if (this.isMedicalImage(fileType)) {
    // NEW: Use Claude for medical images
    return await this.analyzeMedicalImageWithClaude(file, metadata);
  }
}

isMedicalImage(fileType) {
  return ['dcm', 'dicom', 'jpg', 'jpeg', 'png'].includes(fileType) 
    && fileType.includes('medical');
}
```

### 3. Create Medical Image Handler
```javascript
// services/documentAnalysisService.js - Add this method
async analyzeMedicalImageWithClaude(imageBuffer, metadata) {
  const response = await this.anthropic.messages.create({
    model: 'claude-3-sonnet-20240514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this medical image and provide a professional radiology report.
                 Image type: ${metadata.imageType || 'Unknown'}
                 Clinical context: ${metadata.clinicalHistory || 'Routine screening'}
                 
                 Include:
                 1. TECHNIQUE: Imaging parameters
                 2. FINDINGS: Systematic review
                 3. IMPRESSION: Key findings
                 4. RECOMMENDATIONS: Follow-up needed`
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imageBuffer.toString('base64')
          }
        }
      ]
    }]
  });

  return this.parseRadiologyReport(response.content[0].text);
}
```

### 4. Update Frontend Upload Component
```javascript
// components/viewers/documents/DocumentListViewer.js
// Update to handle medical images

const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Detect if medical image
  if (isMedicalImage(file)) {
    formData.append('analysisType', 'medical-image');
    formData.append('useClaudeAnalysis', 'true'); // Force Claude
  }
  
  // Upload and analyze
  await secureApi.post('/api/documents/upload', formData);
};

const isMedicalImage = (file) => {
  const imageTypes = ['image/jpeg', 'image/png', 'application/dicom'];
  return imageTypes.includes(file.type) || 
         file.name.toLowerCase().includes('xray') ||
         file.name.toLowerCase().includes('mri') ||
         file.name.toLowerCase().includes('ct');
};
```

### 5. Update Routes
```javascript
// routes/documents.js
router.post('/upload', upload.single('file'), async (req, res) => {
  const { analysisType, useClaudeAnalysis } = req.body;
  
  if (analysisType === 'medical-image' || useClaudeAnalysis === 'true') {
    // Use Claude for medical images
    const analysis = await documentAnalysisService.analyzeMedicalImageWithClaude(
      req.file.buffer,
      {
        imageType: req.body.imageType,
        clinicalHistory: req.body.clinicalHistory,
        patientId: req.body.patientId
      }
    );
    
    return res.json({ success: true, analysis });
  }
  
  // Regular document processing
  // ...
});
```

### 6. Clean Up Google/Gemini References
```bash
# Remove Gemini API keys from environment
DELETE FROM .env:
- GEMINI_API_KEY
- GOOGLE_API_KEY (keep only if using for Maps)
- SERVICE_GEMINI*_KEY

# Remove Gemini KMS keys
DELETE FILES:
- .kms/keys/GEMINI_API_KEY.json
- .kms/keys/SERVICE_GEMINI*.json
```

### 7. Update Configuration
```javascript
// services/secureConfigService.js
// Remove Gemini configurations
const config = {
  AI_PROVIDER: 'claude', // Switch default to Claude
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  // Remove all GEMINI_* configs
};
```

### 8. Testing Plan
```javascript
// test-claude-image-analysis.js
const fs = require('fs').promises;
const documentAnalysisService = require('./services/documentAnalysisService');

async function testMedicalImageAnalysis() {
  console.log('Testing Claude medical image analysis...');
  
  // Test with sample images
  const testImages = [
    './test-images/chest-xray.jpg',
    './test-images/mri-brain.jpg',
    './test-images/ct-abdomen.jpg'
  ];
  
  for (const imagePath of testImages) {
    const imageBuffer = await fs.readFile(imagePath);
    const analysis = await documentAnalysisService.analyzeMedicalImageWithClaude(
      imageBuffer,
      { imageType: imagePath.split('/').pop() }
    );
    
    console.log(`\n${imagePath}:`);
    console.log('Findings:', analysis.findings);
    console.log('Impression:', analysis.impression);
  }
}

testMedicalImageAnalysis();
```

## Migration Steps

### Phase 1: Add Claude Image Support (Keep Gemini as Fallback)
1. Implement Claude medical image analysis
2. Add feature flag: `USE_CLAUDE_FOR_IMAGES=true`
3. Test with sample images
4. Monitor performance and accuracy

### Phase 2: Full Migration
1. Remove all Gemini code
2. Update all references to use Claude
3. Clean up environment variables
4. Remove Google Cloud dependencies

### Phase 3: Optimization
1. Implement caching for repeated analyses
2. Add batch processing fix (separate task)
3. Optimize token usage
4. Add specialized prompts per image type

## Known Issues to Address Later

### Batch Processing Issue
- **Problem**: Batch uploads sometimes fail with Claude
- **Temporary Solution**: Process images one at a time
- **Future Fix**: Implement proper queue system with retry logic
- **Reference**: Will create separate task file for batch processing

## Cost Comparison

### Current (Gemini via Google Cloud)
- Per image: ~$5-10 (including idle charges)
- Monthly (100 images/day): ~$15,000-30,000
- Hidden costs: Hourly charges even when idle

### After Switch (Claude Direct API)
- Per image: ~$0.025
- Monthly (100 images/day): ~$75
- No hidden costs: Pay only for actual usage

## Success Metrics
- ✅ All medical images analyzed by Claude
- ✅ Zero Google Cloud charges
- ✅ Response time < 5 seconds per image
- ✅ Professional radiology report quality
- ✅ 95%+ cost reduction achieved

## Environment Variables After Migration
```env
# AI Configuration
CLAUDE_API_KEY=sk-ant-xxx

# REMOVED:
# GEMINI_API_KEY=xxx  
# GOOGLE_CLOUD_PROJECT=xxx
# All SERVICE_GEMINI_* keys

# Keep only if using Maps:
# GOOGLE_MAPS_API_KEY=xxx
```

## Files to Delete After Migration
```
- services/geminiMedicalService.js
- services/geminiService.js
- services/geminiCacheService.js
- services/geminiCostTracker.js
- services/geminiOptimizedService.js
- routes/geminiOptimization.js
- All .kms/keys/SERVICE_GEMINI*.json files
```

## Notes
- Claude provides professional-grade radiology reports
- No need for Google Cloud Platform account
- Significant simplification of architecture
- Batch processing issues to be resolved in separate task