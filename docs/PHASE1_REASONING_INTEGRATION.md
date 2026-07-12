# Phase 1 Reasoning Display - Integration Guide

## Overview
This guide shows how to display Claude's Phase 1 document analysis reasoning in the IntelliCare frontend. The reasoning is already being stored in `batch_metadata` and emitted via WebSocket - we just need to display it.

## What's Already Implemented ✅

### Backend (batchResultsWorker.js lines 433-460)
The reasoning is already:
1. **Stored** in `batch_metadata.reasoning` field
2. **Emitted** via WebSocket `batchStatus` event with type `phase1_complete`

```javascript
// Line 433 - Stored in database
await SecureDataAccess.update(
  'batch_metadata',
  { batchId: batch.batchId },
  {
    $set: {
      status: 'phase1_complete',
      reasoning: extracted?.reasoning || '',  // ✅ Already stored!
      // ...
    }
  }
);

// Lines 443-460 - WebSocket emission
global.io.emit('batchStatus', {
  type: 'phase1_complete',
  batchId: batch.batchId,
  reasoning: extracted?.reasoning || '',  // ✅ Already sent!
  selectedCollections: selectedCollections,
  // ...
});
```

## New Files Created

### 1. Service Layer
**File**: `apps/frontend-vite/src/services/batchNotificationService.js`
- Singleton service that connects to WebSocket
- Listens for `batchStatus` events
- Provides `subscribe(callback)` method for components

### 2. Components
**File**: `apps/frontend-vite/src/components/DocumentAnalysisReasoning.jsx`
- Displays reasoning text from batch analysis
- Shows loading/error states

**File**: `apps/frontend-vite/src/components/BatchNotificationContainer.jsx`
- Main container component that listens for notifications
- Shows toast notifications for different event types
- Displays reasoning modal when Phase 1 completes

### 3. Styles
- `DocumentAnalysisReasoning.css` - Component styles
- `BatchNotificationContainer.css` - Toast and modal styles

## Integration Steps

### Step 1: Add Container to App Layout

Edit `apps/frontend-vite/src/App.jsx` (or your main layout file):

```jsx
import BatchNotificationContainer from './components/BatchNotificationContainer';

function App() {
  return (
    <>
      {/* Your existing app content */}
      <Router>
        {/* ... routes ... */}
      </Router>
      
      {/* Add this line - it will handle all batch notifications globally */}
      <BatchNotificationContainer />
    </>
  );
}
```

### Step 2: Alternative - Use in Specific Component

If you only want to show reasoning on the document processing page:

```jsx
import React, { useState, useEffect } from 'react';
import batchNotificationService from '../services/batchNotificationService';
import DocumentAnalysisReasoning from '../components/DocumentAnalysisReasoning';

const DocumentProcessingPage = () => {
  const [currentReasoning, setCurrentReasoning] = useState(null);

  useEffect(() => {
    const unsubscribe = batchNotificationService.subscribe((event, data) => {
      if (event === 'batchStatus' && data.type === 'phase1_complete') {
        setCurrentReasoning({
          batchId: data.batchId,
          reasoning: data.reasoning,
          patientName: data.patientName
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h1>Document Processing</h1>
      
      {currentReasoning && (
        <DocumentAnalysisReasoning 
          batchId={currentReasoning.batchId}
          onClose={() => setCurrentReasoning(null)}
        />
      )}
    </div>
  );
};
```

### Step 3: Test the Integration

1. Upload a document for batch processing
2. Watch the browser console for: `📊 Batch status update: {type: 'phase1_complete', ...}`
3. A toast notification should appear
4. Click the notification to see the full reasoning modal

## API Endpoint (Alternative to WebSocket)

If you prefer polling, the reasoning is also available via the existing API:

```javascript
// GET /api/batch/status/:batchId
const response = await fetch(`/api/batch/status/${batchId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

const data = await response.json();
// data.batch.reasoning contains the Phase 1 reasoning
```

## Event Types

The WebSocket emits these event types:

| Type | Description |
|------|-------------|
| `phase1_complete` | Document analysis complete - contains reasoning |
| `phase2_complete` | Data extraction complete - contains extracted fields |
| `processing` | Document processing in progress |
| `error` | Processing error occurred |

## Data Flow

```
User Uploads Document
        ↓
batchResultsWorker.js (Phase 1)
        ↓
Claude analyzes document
        ↓
Reasoning stored in batch_metadata.reasoning ✅
        ↓
WebSocket emits 'batchStatus' event ✅
        ↓
Frontend receives event (NEW)
        ↓
Toast notification shown (NEW)
        ↓
User clicks notification → Reasoning modal displayed (NEW)
```

## Troubleshooting

### No notifications appearing?
1. Check browser console for WebSocket connection errors
2. Verify `batchNotificationService.connect()` is called
3. Check backend logs for WebSocket emissions

### Reasoning is empty?
1. Check `batch_metadata` collection for the batchId
2. Verify `reasoning` field exists in the document
3. Check backend logs for Phase 1 extraction errors

## Summary

All the backend work is done! The reasoning is being stored and sent. The frontend components are ready - just add `<BatchNotificationContainer />` to your App.jsx and you'll see the reasoning displayed in real-time when documents are processed.
