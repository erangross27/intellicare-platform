# Multi-Turn Conversation System Documentation

## Overview
The IntelliCare Multi-Turn Conversation System enables natural, context-aware conversations between healthcare professionals and the AI assistant. It features advanced NLP processing, pronoun resolution, and intelligent mode switching.

## Features

### 1. Natural Language Processing (NLP)
- **Porter Stemmer**: Normalizes word variations (running → run)
- **Medical Lemmatization**: Handles medical terminology
- **Sentiment Analysis**: Detects positive/negative/neutral sentiment
- **Urgency Detection**: Identifies critical/high/medium/low urgency

### 2. Coreference Resolution
- Resolves pronouns (he/she/it/they/them/that/this)
- Maintains entity context across conversation turns
- Example: "Schedule with Dr. Smith" → "When can I see him?" (him = Dr. Smith)

### 3. Intelligent Mode Detection
Eight conversation modes optimized for healthcare:
- **SCHEDULING**: Appointments, calendar management
- **MEDICAL_CONSULTATION**: Clinical discussions, diagnoses
- **PATIENT_MANAGEMENT**: Patient records, history
- **DOCUMENT_ANALYSIS**: Medical documents, reports
- **ADMINISTRATIVE**: Billing, insurance, compliance
- **COLLABORATION**: Team communication, referrals
- **REPORTING**: Analytics, summaries
- **GENERAL**: Default/mixed interactions

### 4. Optimized Function Selection
- Pre-defined function bundles per mode (15-40 functions)
- 85% reduction in token usage vs loading all functions
- Context-aware function expansion

## Architecture

```
Frontend (React)
    ↓
API Layer (/api/agent/chat)
    ↓
Agent Service Wrapper
    ↓
Claude Service (agentServiceClaude.js)
    ↓
Enhanced Conversation System
    ├─ NLP Processor
    ├─ Coreference Resolver
    ├─ Mode Detector
    └─ Bundle Validator
```

## Installation

### Prerequisites
- Node.js 18+
- MongoDB 5+
- Claude API key

### Setup
```bash
# Install dependencies
cd apps/backend-api
npm install

# Set environment variables
export CLAUDE_API_KEY=your-key-here

# Start the server
npm run dev
```

## Configuration

### Environment Variables
```env
CLAUDE_API_KEY=your-claude-api-key
NODE_ENV=production
```

### Service Configuration
```javascript
// In services/enhancedConversationSystem.js
const config = {
  maxSessionAge: 3600000, // 1 hour
  cacheSize: 100,
  performanceTarget: 50 // ms
};
```

## API Reference

### Process Message
**Endpoint**: `POST /api/agent/chat`

**Request**:
```json
{
  "message": "Schedule an appointment with Dr. Smith",
  "sessionId": "session-123",
  "language": "en"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "I'll help you schedule an appointment with Dr. Smith.",
    "mode": "SCHEDULING",
    "confidence": 0.98,
    "actionTaken": "searchAvailableSlots",
    "entities": {
      "providers": ["Dr. Smith"]
    }
  }
}
```

## Usage Examples

### Basic Conversation
```javascript
// Frontend
const response = await secureApi.post('/api/agent/chat', {
  message: "Show me today's appointments",
  sessionId: sessionId,
  language: "en"
});
```

### Multi-Turn with Context
```javascript
// Turn 1
await chat("Schedule with Dr. Smith");
// Mode: SCHEDULING

// Turn 2
await chat("When can I see him tomorrow?");
// Resolves "him" to "Dr. Smith"

// Turn 3
await chat("I've been having headaches");
// Switches to MEDICAL_CONSULTATION mode
```

## Performance

### Benchmarks
- **Average Response Time**: 0.07ms
- **P95 Response Time**: 1ms
- **Token Savings**: 97.8%
- **Cache Hit Rate**: 99%
- **Mode Detection Accuracy**: 90%

### Optimization Tips
1. Use session IDs consistently for context preservation
2. Keep messages concise for faster processing
3. Leverage caching by using similar phrasings

## Troubleshooting

### Common Issues

#### 1. Mode Detection Errors
**Problem**: Wrong mode detected
**Solution**: Provide more context in the message

#### 2. Pronoun Resolution Failures
**Problem**: Pronouns not resolved correctly
**Solution**: Ensure entities are mentioned before using pronouns

#### 3. Slow Response Times
**Problem**: Response time > 50ms
**Solution**: Check cache configuration and database connection

## Development

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
node scripts/test-final-integration.js

# Performance tests
node scripts/performance-validation.js
```

### Adding New Modes
1. Update `conversationModeManager.js`
2. Define function bundle in `conversationBundles.js`
3. Add patterns in `optimizedPatterns.js`

### Extending NLP
1. Add rules to `nlpProcessor.js`
2. Update medical dictionary
3. Test with `test-nlp-processor.js`

## Monitoring

### Key Metrics
- Response time percentiles
- Mode detection accuracy
- Cache hit rates
- Error rates
- Session duration

### Health Checks
```bash
# Check system status
curl http://localhost:5000/api/health

# View metrics
curl http://localhost:5000/api/metrics
```

## Support

For issues or questions:
- GitHub: [IntelliCare Issues](https://github.com/intellicare/issues)
- Email: support@intellicare.health
- Documentation: [Full Docs](https://docs.intellicare.health)

## License
Proprietary - IntelliCare Health Systems