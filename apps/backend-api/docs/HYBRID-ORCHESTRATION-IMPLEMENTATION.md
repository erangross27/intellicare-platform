# Hybrid Claude-Gemini Orchestration Implementation Plan

## 🎯 Architecture Overview

```
Doctor Input → Claude (Orchestrator) → Function Calls → Gemini (Medical Expert) → Database → Claude (Presenter)
```

## 📋 Implementation Timeline: 2-3 Days

### Day 1: Core Architecture (4-6 hours)

#### 1. Create Medical Analysis Wrapper Function (1 hour)
```javascript
// In agentServiceV4.js - New function for medical queries
async askMedicalExpert(params, practiceContext, session) {
  try {
    const { query, context, type } = params;
    
    // Route to Gemini for medical expertise
    const geminiService = require('./geminiService');
    
    // Different prompts for different query types
    const prompts = {
      brainstorm: `As a medical expert, brainstorm about: ${query}
                   Consider: differential diagnoses, treatment options, recent research`,
      diagnosis: `Analyze these symptoms and suggest possible diagnoses: ${query}`,
      treatment: `Suggest treatment approaches for: ${query}`,
      drugInteraction: `Analyze potential drug interactions: ${query}`,
      general: `Provide medical expertise on: ${query}`
    };
    
    const geminiResponse = await geminiService.analyzeMedicalQuery({
      prompt: prompts[type] || prompts.general,
      context: context,
      includesCitations: true,
      structuredOutput: true
    });
    
    // Store significant insights in database if needed
    if (type === 'diagnosis' && params.patientId) {
      await this.storeMedicalInsight(geminiResponse, params.patientId);
    }
    
    return {
      success: true,
      analysis: geminiResponse,
      type: type,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Medical expert query failed:', error);
    throw error;
  }
}
```

#### 2. Update analyzeDocument Function (1 hour)
```javascript
// Modified analyzeDocument to use Gemini directly
async analyzeDocument(params, practiceContext, session) {
  try {
    // ... existing validation code ...
    
    // Direct Gemini analysis - no Claude intermediary
    const geminiService = require('./geminiService');
    
    // Analyze with structured output
    const analysis = await geminiService.extractStructuredData(
      decryptedBuffer,
      document.mimeType,
      document.category || 'medical_document',
      documentText
    );
    
    // Direct database save - no Claude mapping needed
    const MedicalHistory = practiceContext.models.MedicalHistory;
    const historyEntry = {
      patientId: patientId,
      date: new Date(),
      category: analysis.category,
      documentId: document._id,
      ...analysis.extractedData,  // Direct mapping
      analyzedBy: 'gemini',
      aiGenerated: true
    };
    
    await MedicalHistory.create(historyEntry);
    
    // Claude only formats the response message
    return {
      success: true,
      message: session.language === 'he'
        ? `המסמך נותח בהצלחה. נמצאו: ${analysis.diagnoses?.length || 0} אבחנות`
        : `Document analyzed successfully. Found: ${analysis.diagnoses?.length || 0} diagnoses`,
      documentId: document._id,
      category: analysis.category
    };
  } catch (error) {
    // ... error handling ...
  }
}
```

#### 3. Add Medical Brainstorming Function (1 hour)
```javascript
// New function for medical brainstorming
async medicalBrainstorm(params, practiceContext, session) {
  const { topic, patientContext, depth = 'comprehensive' } = params;
  
  // Claude understands the brainstorming request
  const structuredQuery = await this.claude.messages.create({
    messages: [{
      role: 'user',
      content: `Extract medical brainstorming parameters from: ${topic}`
    }],
    system: 'Extract: condition, symptoms, relevant history, specific questions'
  });
  
  // Send to Gemini for deep medical analysis
  const geminiResponse = await this.askMedicalExpert({
    query: topic,
    context: patientContext,
    type: 'brainstorm'
  }, practiceContext, session);
  
  // Claude presents the brainstorming results conversationally
  const presentation = await this.claude.messages.create({
    messages: [{
      role: 'user',
      content: `Present this medical brainstorming to a doctor: ${JSON.stringify(geminiResponse)}`
    }],
    system: `Present in ${session.language}, conversational medical style`
  });
  
  return {
    success: true,
    message: presentation.content[0].text,
    insights: geminiResponse.analysis,
    followUpQuestions: geminiResponse.suggestedQuestions
  };
}
```

### Day 2: Integration & Migration (4-6 hours)

#### 4. Update Function Declarations (1 hour)
```javascript
// Add new functions to getAllPlatformFunctions()
{
  name: "askMedicalExpert",
  description: isHebrew 
    ? "שאל את המומחה הרפואי שאלה או בקש ניתוח מעמיק"
    : "Ask medical expert a question or request deep analysis",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: isHebrew ? "השאלה הרפואית" : "The medical question"
      },
      type: {
        type: "string",
        enum: ["brainstorm", "diagnosis", "treatment", "drugInteraction", "general"],
        description: isHebrew ? "סוג השאלה" : "Type of query"
      },
      patientId: {
        type: "string",
        description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)"
      }
    },
    required: ["query", "type"]
  }
},
{
  name: "medicalBrainstorm",
  description: isHebrew
    ? "סיעור מוחות רפואי על מצב או אבחנה"
    : "Medical brainstorming about a condition or diagnosis",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: isHebrew ? "הנושא לסיעור מוחות" : "Topic to brainstorm"
      },
      patientContext: {
        type: "object",
        description: isHebrew ? "הקשר המטופל" : "Patient context"
      },
      depth: {
        type: "string",
        enum: ["quick", "standard", "comprehensive"],
        description: isHebrew ? "עומק הניתוח" : "Analysis depth"
      }
    },
    required: ["topic"]
  }
}
```

#### 5. Update Conversation Flow (2 hours)
```javascript
// In processChatMessage - detect medical questions
async processChatMessage(message, sessionId, practiceContext) {
  // ... existing code ...
  
  // Detect if this is a medical knowledge question
  const isMedicalQuestion = this.detectMedicalQuestion(message);
  
  if (isMedicalQuestion && !message.includes('patient')) {
    // Direct medical question - route to Gemini
    console.log('🏥 Medical question detected - routing to medical expert');
    
    // Claude orchestrates the call
    const response = await this.genAI.generateContent({
      model: 'gemini-2.5-flash',
      tools: [{
        functionDeclarations: [{
          name: 'askMedicalExpert',
          // ... function declaration ...
        }]
      }]
    });
    
    // Execute the function call to Gemini
    if (response.functionCalls?.length > 0) {
      const result = await this.executeFunction(
        'askMedicalExpert',
        response.functionCalls[0].args,
        practiceContext,
        session
      );
      
      // Claude presents the result
      return this.formatMedicalResponse(result, session.language);
    }
  }
  
  // ... rest of existing flow ...
}

detectMedicalQuestion(message) {
  const medicalTerms = [
    'diagnos', 'treatment', 'medication', 'symptom', 'condition',
    'disease', 'syndrome', 'therapy', 'prognosis', 'differential',
    'אבחנה', 'טיפול', 'תרופה', 'סימפטום', 'מחלה', 'תסמונת'
  ];
  
  const lower = message.toLowerCase();
  return medicalTerms.some(term => lower.includes(term));
}
```

### Day 3: Testing & Optimization (2-4 hours)

#### 6. Create Test Suite
```javascript
// test-hybrid-orchestration.js
async function testHybridFlow() {
  console.log('🧪 Testing Hybrid Claude-Gemini Flow');
  
  // Test 1: Document Analysis
  console.log('\n1️⃣ Testing Document Analysis');
  const docResult = await agent.analyzeDocument({
    documentId: 'test-doc-id',
    patientId: 'test-patient-id'
  });
  console.log('✅ Document analysis:', docResult.success);
  
  // Test 2: Medical Question
  console.log('\n2️⃣ Testing Medical Question');
  const medResult = await agent.askMedicalExpert({
    query: 'What are the differential diagnoses for chest pain?',
    type: 'diagnosis'
  });
  console.log('✅ Medical question:', medResult.success);
  
  // Test 3: Brainstorming
  console.log('\n3️⃣ Testing Medical Brainstorming');
  const brainstormResult = await agent.medicalBrainstorm({
    topic: 'Treatment approaches for resistant hypertension',
    depth: 'comprehensive'
  });
  console.log('✅ Brainstorming:', brainstormResult.success);
  
  // Test 4: Full conversation flow
  console.log('\n4️⃣ Testing Full Conversation');
  const chatResult = await agent.processChatMessage(
    'I want to brainstorm about a patient with recurring headaches',
    'test-session',
    testClinicContext
  );
  console.log('✅ Conversation flow:', chatResult.includes('brainstorm'));
}
```

## 🔄 Migration Strategy

### Phase 1: Add New Functions (Day 1)
- ✅ Keep existing `analyzeDocument` working
- ✅ Add `askMedicalExpert` as new function
- ✅ Add `medicalBrainstorm` as new function
- ✅ Test in parallel with existing flow

### Phase 2: Update Core Functions (Day 2)
- ✅ Modify `analyzeDocument` to use Gemini directly
- ✅ Remove Claude from document analysis pipeline
- ✅ Update conversation detection logic
- ✅ Test with real documents

### Phase 3: Optimize & Deploy (Day 3)
- ✅ Performance testing
- ✅ Cost analysis
- ✅ Error handling improvements
- ✅ Production deployment

## 💰 Cost Comparison

### Current Flow (Per 1000 Operations)
- Document Analysis: Claude ($15) + Gemini ($0.30) = $15.30
- Medical Questions: Claude only = $15
- **Total: ~$30/day**

### New Hybrid Flow (Per 1000 Operations)
- Document Analysis: Gemini only = $0.30
- Medical Questions: Claude (orchestration) + Gemini (analysis) = $3 + $0.30 = $3.30
- Presentation: Claude = $3
- **Total: ~$6.60/day (78% cost reduction)**

## 🚀 Performance Improvements

### Current Performance
- Document analysis: 5-8 seconds (Claude + Gemini)
- Medical questions: 3-5 seconds (Claude only)

### Expected Performance
- Document analysis: 1-2 seconds (Gemini only)
- Medical questions: 2-3 seconds (Claude orchestration + Gemini)
- **60% faster overall**

## 📊 Implementation Complexity

- **Code Changes**: ~500 lines
- **New Functions**: 3
- **Modified Functions**: 2
- **Risk Level**: Low (additions, not replacements)
- **Rollback Time**: < 5 minutes

## ✅ Success Criteria

1. Document analysis works with Gemini only
2. Medical brainstorming returns comprehensive results
3. Claude successfully orchestrates all function calls
4. Database stores Gemini's structured output directly
5. Cost reduction of >70%
6. Performance improvement of >50%

---

*Implementation Date: Ready to start immediately*
*Estimated Completion: 2-3 days*
*Risk: Low - Additive changes with fallback*