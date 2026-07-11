# Split-Screen Dark Mode Implementation Guide

## Overview
The IntelliCare split-screen interface provides a professional dark blue theme with minimal clicking and automatic context-aware content display. The interface dynamically adjusts based on function call results from the AI agent.

## Design Principles

### 1. Minimal Interaction
- **Auto-open panels** when relevant data is available
- **No tabs or menus** - direct content display
- **Single click to close** - clean X button
- **Smart context switching** - automatic based on user intent

### 2. Professional Dark Theme
```css
/* Color Palette */
--dark-bg-primary: #0a0e27      /* Deep blue background */
--dark-bg-secondary: #141832    /* Slightly lighter blue */
--dark-bg-tertiary: #1e2341     /* Panel backgrounds */
--dark-text-primary: #e8eaf0    /* Light text */
--dark-text-secondary: #a8b2d1  /* Muted text */
--dark-accent: #4a9eff          /* Bright blue accent */
--dark-border: #2a3050          /* Subtle borders */
```

### 3. Responsive Layout
- **Chat-only mode**: Full width when no context
- **Split mode**: 50/50 or 60/40 split with context panel
- **RTL support**: Automatic layout flip for Hebrew

## Component Architecture

### ChatLayoutDark Component

```javascript
// Main container managing split-screen state
const ChatLayoutDark = () => {
  const [activeContext, setActiveContext] = useState(null);
  const [contextData, setContextData] = useState(null);
  
  // Context types: 'patient', 'document', 'labs', 'medications'
  
  // Global handlers for chat integration
  useEffect(() => {
    window.handlePatientData = handlePatientData;
    window.handleDocumentSelect = handleDocumentSelect;
    window.handleLabResults = handleLabResults;
    window.handleMedications = handleMedications;
  }, []);
  
  return (
    <div className="chat-layout-dark">
      {activeContext && <ContextPanel />}
      <ChatPanel className={activeContext ? 'with-context' : 'full-width'} />
    </div>
  );
};
```

### CSS Structure

```css
/* ChatLayoutDark.css */
.chat-layout-dark {
  display: flex;
  height: 100vh;
  background: var(--dark-bg-primary);
  position: relative;
}

/* Chat Panel Styles */
.chat-panel-dark {
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.chat-panel-dark.full-width {
  width: 100%;
}

.chat-panel-dark.with-context {
  width: 50%;
}

/* Context Panel Styles */
.context-panel-dark {
  width: 50%;
  background: var(--dark-bg-secondary);
  border-left: 1px solid var(--dark-border);
  position: relative;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Close Button */
.close-panel-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.close-panel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}
```

## Viewer Components

### PatientCardDark
Minimalist patient information display with essential details only.

```javascript
const PatientCardDark = ({ patient, language }) => {
  const isRTL = language === 'he';
  
  return (
    <div className="patient-card-dark">
      {/* Patient Photo/Avatar */}
      <div className="patient-header">
        <div className="patient-avatar">
          {patient.firstName?.[0]}{patient.lastName?.[0]}
        </div>
        <div className="patient-name">
          <h2>{patient.firstName} {patient.lastName}</h2>
          <span className="patient-id">ID: {patient._id}</span>
        </div>
      </div>
      
      {/* Key Information Grid */}
      <div className="patient-info-grid">
        <InfoItem label={t('age')} value={calculateAge(patient.dateOfBirth)} />
        <InfoItem label={t('phone')} value={patient.phone} />
        <InfoItem label={t('email')} value={patient.email} />
        <InfoItem label={t('address')} value={formatAddress(patient)} />
      </div>
      
      {/* Quick Actions */}
      <div className="patient-actions">
        <button className="action-btn primary">
          {isRTL ? 'עדכן פרטים' : 'Update Details'}
        </button>
        <button className="action-btn secondary">
          {isRTL ? 'הצג היסטוריה' : 'View History'}
        </button>
      </div>
    </div>
  );
};
```

### DocumentViewerSimple
Clean document display with OCR results and AI insights.

```javascript
const DocumentViewerSimple = ({ documentId, language }) => {
  const [document, setDocument] = useState(null);
  
  return (
    <div className="document-viewer-simple">
      {/* Document Header */}
      <div className="document-header">
        <h3>{document?.name}</h3>
        <span className="document-date">{formatDate(document?.date)}</span>
      </div>
      
      {/* Document Content */}
      <div className="document-content">
        {document?.type === 'image' ? (
          <img src={document.url} alt={document.name} />
        ) : (
          <div className="document-text">{document.content}</div>
        )}
      </div>
      
      {/* AI Insights */}
      {document?.aiInsights && (
        <div className="ai-insights">
          <h4>{language === 'he' ? 'תובנות AI' : 'AI Insights'}</h4>
          <ul>
            {document.aiInsights.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## Function Call Integration

### Chat Response Handler

```javascript
// In ChatInterfaceDark.js
const handleSendMessage = async () => {
  const response = await fetch('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({ message, sessionId, language })
  });
  
  const result = await response.json();
  
  // Smart split-screen triggering
  if (result.actionResult) {
    handleActionResult(result.actionResult, result.actionTaken);
  }
};

const handleActionResult = (actionResult, actionType) => {
  switch (actionType) {
    case 'searchPatients':
    case 'getPatient':
      if (actionResult.patients?.[0] || actionResult.patient) {
        window.handlePatientData(
          actionResult.patient || actionResult.patients[0]
        );
      }
      break;
      
    case 'getDocuments':
      if (actionResult.documents?.[0]) {
        window.handleDocumentSelect(actionResult.documents[0]._id);
      }
      break;
      
    case 'getLabResults':
      if (actionResult.patient) {
        window.handleLabResults(actionResult.patient);
      }
      break;
  }
};
```

## State Management

### Context Flow
```
User Message → AI Processing → Function Call → 
Backend Response → Action Detection → 
Split Screen Trigger → Context Panel Update
```

### Session Persistence
```javascript
// Maintain context across messages
const session = {
  history: [],
  activePatientId: null,
  activeDocumentId: null,
  language: 'he',
  clinicCountry: 'Israel'
};
```

## Optimization Strategies

### 1. Lazy Loading
```javascript
// Load viewers only when needed
const PatientCardDark = lazy(() => import('./viewers/PatientCardDark'));
const DocumentViewerSimple = lazy(() => import('./viewers/DocumentViewerSimple'));
```

### 2. Memoization
```javascript
// Prevent unnecessary re-renders
const MemoizedPatientCard = memo(PatientCardDark, (prev, next) => {
  return prev.patient._id === next.patient._id;
});
```

### 3. Debounced Updates
```javascript
// Debounce rapid context switches
const debouncedSetContext = useMemo(
  () => debounce(setActiveContext, 300),
  []
);
```

## Accessibility Features

### Keyboard Navigation
```javascript
// Keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'Escape' && activeContext) {
      handleClosePanel();
    }
    if (e.ctrlKey && e.key === 'p') {
      // Toggle patient panel
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
}, [activeContext]);
```

### Screen Reader Support
```html
<!-- ARIA labels -->
<button 
  className="close-panel-btn"
  aria-label="Close side panel"
  role="button"
>
```

## Mobile Responsiveness

```css
/* Mobile Layout */
@media (max-width: 768px) {
  .chat-layout-dark {
    flex-direction: column;
  }
  
  .context-panel-dark {
    position: fixed;
    width: 100%;
    height: 60vh;
    bottom: 0;
    border-left: none;
    border-top: 1px solid var(--dark-border);
  }
  
  .chat-panel-dark.with-context {
    height: 40vh;
    width: 100%;
  }
}
```

## Testing Scenarios

### Manual Testing Checklist
1. ✅ Chat-only mode displays full width
2. ✅ Patient search triggers split screen
3. ✅ Close button returns to chat-only
4. ✅ Context switches smoothly between types
5. ✅ RTL layout works correctly
6. ✅ Mobile view stacks panels vertically
7. ✅ Keyboard shortcuts function properly
8. ✅ Dark theme consistent across components

### Automated Tests
```javascript
// Example test case
describe('Split Screen Functionality', () => {
  it('should open patient panel on search', async () => {
    const { getByText, getByTestId } = render(<ChatLayoutDark />);
    
    // Simulate patient search
    fireEvent.click(getByText('Search'));
    await waitFor(() => {
      expect(getByTestId('context-panel')).toBeInTheDocument();
    });
  });
});
```

## Performance Metrics

### Target Metrics
- **Panel open animation**: < 300ms
- **Context switch**: < 100ms
- **Data load**: < 500ms
- **Memory usage**: < 50MB per panel

### Monitoring
```javascript
// Performance tracking
const measurePanelOpen = () => {
  performance.mark('panel-open-start');
  // ... open panel
  performance.mark('panel-open-end');
  performance.measure('panel-open', 'panel-open-start', 'panel-open-end');
};
```

## Troubleshooting Guide

### Common Issues

1. **Panel not opening**
   - Check window.handlePatientData binding
   - Verify actionResult structure
   - Check console for errors

2. **Layout breaking on resize**
   - Verify flexbox properties
   - Check media queries
   - Test transition animations

3. **Dark theme inconsistencies**
   - Verify CSS variable usage
   - Check component-specific overrides
   - Test in different browsers

## Future Enhancements

### Planned Features
1. **Drag-to-resize** panels
2. **Multi-panel support** (2+ contexts)
3. **Panel pinning** for persistent display
4. **Custom themes** beyond dark mode
5. **Animation preferences** for reduced motion

### Code Examples for Future Features

```javascript
// Resizable panels
const [panelWidth, setPanelWidth] = useState(50);

const handleResize = (e) => {
  const newWidth = (e.clientX / window.innerWidth) * 100;
  setPanelWidth(Math.min(80, Math.max(20, newWidth)));
};

// Multi-panel support
const [panels, setPanels] = useState([]);

const addPanel = (type, data) => {
  setPanels([...panels, { id: Date.now(), type, data }]);
};
```

## Conclusion

The split-screen dark mode implementation provides a professional, efficient interface for medical professionals. By minimizing clicks and automatically displaying relevant information, the system enhances productivity while maintaining a clean, modern aesthetic.

---
*Last Updated: August 15, 2025*
*Version: 1.0*
*Components: 4 viewers, 2 layouts*
*Theme: Professional Dark Blue*