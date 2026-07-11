# Task 16: Optimize searchChatHistory Function

## Current Issue
- Returns FULL chat messages with entire conversations
- Includes system prompts and tool calls
- Each message can be 1,000+ chars
- 100 messages = massive token count

## Location
- File: `services/agentServiceV4.js`
- Line: ~18045

## Current Return Structure
```javascript
{
  data: [
    {
      _id, sessionId, timestamp,
      userMessage: "Full user message text...",
      aiResponse: "Complete AI response with all details...",
      context: { /* Full context object */ },
      toolCalls: [...],
      metadata: {...},
      // More fields
    }
  ]
}
```

## Smart Chat History Optimization
```javascript
// Return conversation summaries, not full text
const optimizedHistory = sessions.map(session => ({
  sessionId: session._id,
  date: session.startTime,
  duration: calculateDuration(session),
  messageCount: session.messages.length,
  topic: extractTopic(session), // Auto-detect main topic
  summary: generateSummary(session), // 50-word summary
  outcome: session.resolved ? 'Resolved' : 'Ongoing'
}));

// If searching for specific content
if (params.searchQuery) {
  return {
    matches: matchedMessages.map(msg => ({
      sessionId: msg.sessionId,
      timestamp: msg.timestamp,
      snippet: extractSnippet(msg, searchQuery), // 100 chars around match
      matchType: 'user' | 'ai',
      relevance: calculateRelevance(msg, searchQuery)
    })),
    totalMatches: count,
    sessions: uniqueSessions.length
  };
}
```

## Time-Based Grouping
```javascript
return {
  today: {
    sessions: 5,
    messages: 47,
    topics: ['Patient inquiry', 'Appointment', 'Lab results']
  },
  thisWeek: {
    sessions: 23,
    messages: 312,
    topTopics: extractTopTopics(thisWeek, 5)
  },
  older: {
    available: true,
    sessionCount: 145
  }
};
```

## Context Recovery
```javascript
// For continuing conversations
if (params.sessionId) {
  return {
    session: {
      id: sessionId,
      lastActive: timestamp,
      context: {
        patientId: session.currentPatient,
        topic: session.currentTopic
      },
      recentMessages: session.messages.slice(-3).map(m => ({
        role: m.role,
        preview: m.content.substring(0, 100)
      }))
    }
  };
}
```

## Expected Result
- Session list: 300 tokens (from 10,000+)
- Search results: 200 tokens with snippets
- Context recovery: 150 tokens
- Full conversation: Only on specific request