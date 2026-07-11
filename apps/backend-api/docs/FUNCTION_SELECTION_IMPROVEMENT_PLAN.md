# 🚀 Function Selection Improvement Plan for 1500+ Functions
*IntelliCare Platform - January 2025*

## 📊 Current Problem Analysis

### Issues with Current System
- **BioLORD-2023 Model Limitations**: Medical embedding model lacks function-specific training
- **Single-stage retrieval**: No reranking or verification step
- **41.5% confidence on wrong function**: Picked `batchUpdatePatients` instead of `importPatientsFromCSV`
- **No context awareness**: Doesn't understand upload IDs, CSV context, or user intent
- **No learning from success**: System doesn't improve from successful function calls

### Why Current Embeddings Fail
1. **Semantic ambiguity**: "Add patients" maps to both single add and batch import
2. **Missing context signals**: Upload ID presence not weighted in selection
3. **Generic embeddings**: Not fine-tuned for function/tool selection task
4. **No feedback loop**: Successful calls don't improve future selections

## 🎯 Proposed Solution: Multi-Stage Intelligent Retrieval

### Stage 1: Context-Aware Preprocessing
```javascript
// Detect context signals BEFORE embedding
const contextDetector = {
  hasUpload: query.includes('[UPLOAD_ID:'),
  hasCSV: /\.csv|csv file/i.test(query),
  operationType: detectOperation(query), // add/update/delete/list
  entityType: detectEntity(query), // patient/appointment/document
  batchOperation: /batch|bulk|multiple|all|csv|import/i.test(query)
};
```

### Stage 2: Hybrid Embedding System

#### Option A: Fine-Tune BGE-M3 (Recommended)
```python
# BGE-M3 supports dense + sparse + ColBERT in one model
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)

# Fine-tune on your function dataset
training_data = generate_function_training_data()
model.fine_tune(training_data, task='function_retrieval')
```

**Advantages:**
- Multi-functionality: Dense, sparse, and ColBERT retrieval
- 8192 token context (handles long function descriptions)
- Already proven in production
- Open source (MIT license)

#### Option B: Use Specialized Function Model (ToolACE-8B)
- State-of-the-art for function calling (89.17% accuracy)
- Pre-trained on 26,507 APIs
- Drop-in replacement possible

### Stage 3: Two-Stage Retrieval + Reranking

```python
class ImprovedFunctionSelector:
    def __init__(self):
        self.embedder = BGEM3Model()  # Or fine-tuned version
        self.reranker = CohereRerank3()  # Or BGE-reranker-v2-m3

    def select_functions(self, query, context, max_functions=5):
        # Stage 1: Fast retrieval (top 20 candidates)
        candidates = self.embedder.search(
            query=self.preprocess_query(query, context),
            top_k=20,  # Over-fetch
            method=['dense', 'sparse', 'colbert']  # Hybrid search
        )

        # Stage 2: Precise reranking
        reranked = self.reranker.rerank(
            query=query,
            documents=candidates,
            context=context,
            top_k=max_functions
        )

        return reranked
```

### Stage 4: Create Training Dataset from Logs

```javascript
// Extract successful function calls from logs
const trainingDataGenerator = {
  async generateFromLogs() {
    const successfulCalls = await SecureDataAccess.query(
      'agent_memories',
      {
        confidenceScore: { $gte: 0.8 },
        workflowFunctions: { $exists: true }
      },
      { limit: 10000 },
      context
    );

    // Format: (query, correct_function, context)
    return successfulCalls.map(call => ({
      query: call.query,
      positive_function: call.workflowFunctions[0],
      negative_functions: this.getSimilarButWrong(call),
      context: {
        hasUpload: call.hasUpload,
        entityType: call.entityType,
        operationType: call.operationType
      }
    }));
  }
};
```

### Stage 5: Continuous Learning Pipeline

```javascript
class FeedbackLoop {
  async recordSuccess(query, selectedFunction, actualFunction, confidence) {
    // Store in learning database
    await SecureDataAccess.insert('function_selection_feedback', {
      query,
      selectedFunction,
      actualFunction,
      correct: selectedFunction === actualFunction,
      confidence,
      timestamp: new Date()
    });

    // Retrain weekly with accumulated data
    if (this.shouldRetrain()) {
      await this.retrainModel();
    }
  }
}
```

## 🔧 Implementation Plan

### Phase 1: Quick Wins (Week 1)
1. **Enhanced Context Detection**
   - Add upload/CSV detection logic
   - Implement operation type detection
   - Add entity extraction

2. **Improved Query Expansion**
   - Add domain-specific synonyms
   - Implement spell correction for medical terms
   - Add context-aware query rewriting

### Phase 2: Embedding Upgrade (Week 2-3)
1. **Deploy BGE-M3**
   - Replace BioLORD-2023 with BGE-M3
   - Implement hybrid search (dense + sparse + ColBERT)
   - Add multi-vector retrieval

2. **Add Reranking Layer**
   - Deploy Cohere Rerank-3 or BGE-reranker-v2-m3
   - Implement two-stage retrieval
   - Add confidence thresholds

### Phase 3: Fine-Tuning (Week 4-5)
1. **Generate Training Data**
   - Extract 10,000+ successful function calls
   - Generate synthetic query variations
   - Create hard negatives dataset

2. **Fine-Tune Model**
   - Use LoRA for efficient fine-tuning
   - Train on function selection task
   - Validate on held-out test set

### Phase 4: Production Deployment (Week 6)
1. **A/B Testing**
   - Compare old vs new system
   - Measure accuracy improvements
   - Monitor latency impact

2. **Feedback Loop**
   - Implement success tracking
   - Set up weekly retraining
   - Monitor drift detection

## 📈 Expected Improvements

### Accuracy Gains
- **Current**: ~40% accuracy on complex queries
- **With BGE-M3**: ~65% accuracy
- **With Reranking**: ~75% accuracy
- **With Fine-tuning**: ~85-90% accuracy

### Performance Metrics
- **Latency**: <300ms total (200ms retrieval + 100ms rerank)
- **Token reduction**: 99.6% → 99.8% (better precision)
- **Context awareness**: 95%+ for upload/CSV scenarios

## 💡 Alternative Approaches

### 1. Hierarchical Function Organization
```javascript
const functionHierarchy = {
  'patient_management': {
    'create': ['addPatient', 'importPatientsFromCSV'],
    'update': ['updatePatient', 'batchUpdatePatients'],
    'delete': ['deletePatient', 'bulkDeletePatients']
  }
};
// First select category, then specific function
```

### 2. LLM-Based Router (Expensive but Accurate)
```javascript
// Use small LLM to route to function category first
const router = await callLLM(
  "Classify this query into function category",
  query
);
// Then use embeddings within that category only
```

### 3. Ensemble Approach
- Combine multiple models' predictions
- Weight by confidence scores
- Use voting mechanism for final selection

## 🔬 Testing Strategy

### Test Dataset Creation
```javascript
const testCases = [
  {
    query: "Add these patients [UPLOAD_ID:123]",
    expected: "importPatientsFromCSV",
    context: { hasUpload: true }
  },
  {
    query: "Update patient John Smith",
    expected: "updatePatient",
    context: { hasUpload: false }
  }
  // ... 1000+ test cases
];
```

### Evaluation Metrics
- **Accuracy@1**: Correct function in top position
- **Accuracy@5**: Correct function in top 5
- **MRR**: Mean Reciprocal Rank
- **Context accuracy**: Correct context detection

## 🚀 Quick Start Implementation

```bash
# 1. Install improved embedding model
pip install -U FlagEmbedding
pip install sentence-transformers

# 2. Download BGE-M3 model
python -c "from FlagEmbedding import BGEM3FlagModel; model = BGEM3FlagModel('BAAI/bge-m3')"

# 3. Generate training data from logs
node scripts/generate-function-training-data.js

# 4. Fine-tune model
python fine-tune-bge-m3.py --data training_data.json --epochs 3

# 5. Deploy with reranking
node deploy-improved-selector.js
```

## 📊 Monitoring & Maintenance

### Key Metrics to Track
- Function selection accuracy
- Latency percentiles (p50, p95, p99)
- User correction rate
- Confidence score distribution

### Weekly Tasks
- Review failed selections
- Retrain with new data
- Update function descriptions
- Adjust confidence thresholds

## 🎯 Success Criteria

✅ **Week 1**: Context detection reduces CSV import errors by 90%
✅ **Week 3**: Overall accuracy improves to 75%+
✅ **Week 6**: Fine-tuned model achieves 85%+ accuracy
✅ **Ongoing**: Continuous improvement through feedback loop

## 📚 References

1. [ToolACE Framework](https://arxiv.org/html/2409.00920v1) - State-of-the-art function calling
2. [BGE-M3 Model](https://huggingface.co/BAAI/bge-m3) - Multi-functional embeddings
3. [Cohere Rerank-3](https://cohere.com/rerank) - Production reranking
4. [Fine-tuning Embeddings Guide](https://www.philschmid.de/fine-tune-embedding-model-for-rag)
5. [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)

---
*This plan reduces function selection errors from 60% to <10% through context awareness, better embeddings, reranking, and continuous learning.*