# Task 01: Mobile Infrastructure Setup - Safe Implementation

## Objective
Set up mobile infrastructure with WindowSizeContext, emergency rollback system, and viewport verification. Zero risk to existing desktop functionality.

## Small Tasks Breakdown

### Task 1.1: Verify Viewport Meta Tag (15 minutes)
- Check `frontend/public/index.html` for viewport meta tag
- Ensure proper mobile viewport configuration
- No code changes, verification only

### Task 1.2: Create Emergency Mobile Controls (20 minutes)
- Create `frontend/src/utils/mobileConfig.js`
- Add global mobile enable/disable flags
- Add per-component feature flags

### Task 1.3: Create WindowSizeContext (30 minutes)
- Create `frontend/src/context/WindowSizeContext.js`
- Implement debounced resize handling
- Add performance optimizations

### Task 1.4: Update App.js Safely (15 minutes)
- Add WindowSizeProvider to App.js
- Preserve all existing functionality
- Test desktop functionality unchanged

### Task 1.5: Test Infrastructure (20 minutes)
- Verify mobile detection works
- Test emergency disable flags
- Confirm desktop unchanged

## Implementation Details

### Step 1.1: Verify Viewport Meta Tag
Check `frontend/public/index.html` has proper viewport:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
```

### Step 1.2: Create Emergency Mobile Controls
Create `frontend/src/utils/mobileConfig.js`:
```javascript
// Emergency mobile feature controls
export const MOBILE_CONFIG = {
  // Global mobile enable/disable
  MOBILE_ENABLED: true,

  // Per-component feature flags
  MOBILE_NAVIGATION: true,
  MOBILE_FORMS: true,
  MOBILE_PATIENT_LIST: true,
  MOBILE_PATIENT_DETAIL: true,
  MOBILE_MEDICAL_HISTORY: true,
  MOBILE_DOCUMENT_VIEWER: true,

  // Emergency rollback function
  disableAllMobile: () => {
    Object.keys(MOBILE_CONFIG).forEach(key => {
      if (key !== 'disableAllMobile') {
        MOBILE_CONFIG[key] = false;
      }
    });
  }
};

// Helper function for safe mobile enhancement
export const useMobileEnhancement = (componentFlag) => {
  return MOBILE_CONFIG.MOBILE_ENABLED && MOBILE_CONFIG[componentFlag];
};
```

### Step 1.3: Create WindowSizeContext (Performance Optimized)
Create `frontend/src/context/WindowSizeContext.js`:
```javascript
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const WindowSizeContext = createContext();

export const WindowSizeProvider = ({ children }) => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    let timeoutId = null;
    const handleResize = () => {
      // Debounce resize events for performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const breakpoints = useMemo(() => ({
    isMobile: windowSize.width <= 768,
    isTablet: windowSize.width > 768 && windowSize.width <= 1024,
    isDesktop: windowSize.width > 1024,
    isSmallMobile: windowSize.width <= 480,
    isLargeMobile: windowSize.width > 480 && windowSize.width <= 768,
  }), [windowSize.width]);

  const value = useMemo(() => ({
    ...windowSize,
    ...breakpoints
  }), [windowSize, breakpoints]);

  return (
    <WindowSizeContext.Provider value={value}>
      {children}
    </WindowSizeContext.Provider>
  );
};

export const useWindowSize = () => {
  const context = useContext(WindowSizeContext);
  if (!context) {
    throw new Error('useWindowSize must be used within WindowSizeProvider');
  }
  return context;
};
```

### Step 1.4: Update App.js Safely
Add WindowSizeProvider to `frontend/src/App.js` (preserving all existing functionality):
```javascript
import { WindowSizeProvider } from './context/WindowSizeContext';
import { MOBILE_CONFIG } from './utils/mobileConfig';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        {/* Only add WindowSizeProvider if mobile is enabled */}
        {MOBILE_CONFIG.MOBILE_ENABLED ? (
          <WindowSizeProvider>
            <Router
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}
            >
              <AppContent />
            </Router>
          </WindowSizeProvider>
        ) : (
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <AppContent />
          </Router>
        )}
      </LanguageProvider>
    </AuthProvider>
  );
}
```

### Step 4: Test the Context
Create a test component to verify the context works:
```javascript
// Test component (temporary)
import React from 'react';
import { useWindowSize } from '../context/WindowSizeContext';

const TestMobileDetection = () => {
  const { width, height, isMobile, isTablet, isDesktop, isSmallMobile } = useWindowSize();

  return (
    <div style={{ padding: '20px', background: '#f0f0f0', margin: '10px' }}>
      <h3>Mobile Detection Test</h3>
      <p>Width: {width}px</p>
      <p>Height: {height}px</p>
      <p>Is Mobile: {isMobile ? 'Yes' : 'No'}</p>
      <p>Is Small Mobile: {isSmallMobile ? 'Yes' : 'No'}</p>
      <p>Is Tablet: {isTablet ? 'Yes' : 'No'}</p>
      <p>Is Desktop: {isDesktop ? 'Yes' : 'No'}</p>
    </div>
  );
};

export default TestMobileDetection;
```

## Acceptance Criteria

### Task 1.1 - Viewport Verification:
- [ ] Viewport meta tag exists in public/index.html
- [ ] Viewport configuration is mobile-friendly
- [ ] No changes made to existing HTML

### Task 1.2 - Emergency Controls:
- [ ] mobileConfig.js created with all feature flags
- [ ] Global MOBILE_ENABLED flag works
- [ ] Per-component flags functional
- [ ] Emergency disable function works

### Task 1.3 - WindowSizeContext:
- [ ] Context correctly detects window size changes
- [ ] Breakpoints work as expected:
  - `isMobile`: ≤ 768px
  - `isSmallMobile`: ≤ 480px
  - `isLargeMobile`: 481px - 768px
  - `isTablet`: 769px - 1024px
  - `isDesktop`: > 1024px
- [ ] Resize events are debounced (100ms)
- [ ] Only one resize listener for entire app

### Task 1.4 - App.js Integration:
- [ ] WindowSizeProvider added safely
- [ ] Desktop functionality unchanged
- [ ] Mobile context only loads when enabled

### Task 1.5 - Testing:
- [ ] Mobile detection works correctly
- [ ] Emergency disable flags functional
- [ ] Desktop behavior 100% preserved
- [ ] No memory leaks or performance issues

## Testing Steps
1. Verify viewport meta tag in browser dev tools
2. Add test component to verify context works
3. Resize browser window and verify breakpoints change
4. Test on actual mobile devices
5. Verify performance with React DevTools (should see only 1 resize listener)
6. Check for memory leaks
7. Test orientation changes on mobile

## Estimated Time
**3 hours** (increased due to context setup)

## Dependencies
- React Context API
- Existing App.js structure

## Notes
- This context will be used by all other mobile tasks
- Performance is critical - context prevents multiple resize listeners
- Must work with existing RTL/Hebrew language support
- Debouncing prevents excessive re-renders during resize
