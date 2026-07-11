# Task 05: WCAG 2.2 Touch Target Compliance

## Objective
Ensure all interactive elements meet WCAG 2.2 minimum touch target size of 44x44px for accessibility compliance.

## Critical Requirement
WCAG 2.2 Success Criterion 2.5.8 requires interactive elements to be at least 44x44 CSS pixels.

## Files to Update
1. `frontend/src/components/Navigation.js`
2. `frontend/src/components/PatientList.js`
3. `frontend/src/components/PatientDetail.js`
4. All components with buttons, links, or interactive elements

## Implementation

### Step 1: Update Navigation Touch Targets
```javascript
import { useWindowSize } from '../context/WindowSizeContext';

const { isMobile } = useWindowSize();

// Navigation links
const navLinkStyle = useMemo(() => (isActive) => ({
  padding: isMobile ? '12px 16px' : '8px 16px',
  borderRadius: isMobile ? '10px' : '20px',
  textDecoration: 'none',
  color: isMobile ? (isActive ? 'white' : '#374151') : 'white',
  background: isActive ? 
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
    (isMobile ? '#f8f9fa' : 'transparent'),
  fontSize: '14px',
  fontWeight: '500',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',   // WCAG 2.2 requirement
  cursor: 'pointer',
  touchAction: 'manipulation',
}), [isMobile]);

// Hamburger menu button
const hamburgerButtonStyle = useMemo(() => ({
  display: isMobile ? 'flex' : 'none',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',  // WCAG 2.2 requirement
  borderRadius: '8px',
  transition: 'background-color 0.2s ease',
  touchAction: 'manipulation',
}), [isMobile]);

// Language switcher button
const languageButtonStyle = useMemo(() => ({
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#475569',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',  // WCAG 2.2 requirement
  justifyContent: 'center',
  alignItems: 'center',
  fontWeight: '600',
  cursor: 'pointer',
  touchAction: 'manipulation',
  display: 'flex',
}), []);
```

### Step 2: Update Patient List Touch Targets
```javascript
// Patient card buttons
const actionButtonStyle = useMemo(() => ({
  padding: isMobile ? '12px 16px' : '8px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',  // WCAG 2.2 requirement
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  touchAction: 'manipulation',
  transition: 'all 0.2s ease',
}), [isMobile]);

// Add patient button
const addPatientButtonStyle = useMemo(() => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  padding: isMobile ? '14px 20px' : '12px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  minHeight: '44px', // WCAG 2.2 requirement
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  touchAction: 'manipulation',
  transition: 'all 0.3s ease',
}), [isMobile]);

// Search input (also needs proper touch target)
const searchInputStyle = useMemo(() => ({
  padding: isMobile ? '12px 16px' : '10px 14px',
  fontSize: '16px', // Prevents iOS zoom
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  minHeight: '44px', // WCAG 2.2 requirement
  width: '100%',
  maxWidth: isMobile ? '100%' : '300px',
  WebkitAppearance: 'none',
  appearance: 'none',
}), [isMobile]);
```

### Step 3: Update Patient Detail Touch Targets
```javascript
// Tab buttons
const tabButtonStyle = useMemo(() => (isActive) => ({
  padding: isMobile ? '12px 16px' : '10px 20px',
  borderRadius: '10px',
  border: 'none',
  background: isActive ? 
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
    'transparent',
  color: isActive ? 'white' : '#666',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',  // WCAG 2.2 requirement
  width: isMobile ? '100%' : 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  transition: 'all 0.2s ease',
}), [isMobile]);

// Action buttons (Edit, Delete, etc.)
const actionButtonStyle = useMemo(() => (variant = 'primary') => {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
    },
    secondary: {
      background: '#f8f9fa',
      color: '#374151',
      border: '1px solid #e5e7eb',
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
    }
  };

  return {
    ...variants[variant],
    padding: isMobile ? '12px 16px' : '10px 14px',
    borderRadius: '8px',
    border: variant === 'secondary' ? '1px solid #e5e7eb' : 'none',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    minHeight: '44px', // WCAG 2.2 requirement
    minWidth: '44px',  // WCAG 2.2 requirement
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    touchAction: 'manipulation',
    transition: 'all 0.2s ease',
  };
}, [isMobile]);
```

### Step 4: Update Modal and Dialog Touch Targets
```javascript
// Modal close button
const modalCloseButtonStyle = useMemo(() => ({
  position: 'absolute',
  top: '15px',
  right: '15px',
  background: 'none',
  border: 'none',
  fontSize: '20px',
  cursor: 'pointer',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '44px',  // WCAG 2.2 requirement
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  color: '#6b7280',
  touchAction: 'manipulation',
  transition: 'all 0.2s ease',
}), []);

// Modal action buttons
const modalButtonStyle = useMemo(() => (variant = 'primary') => ({
  padding: isMobile ? '14px 20px' : '12px 18px',
  borderRadius: '10px',
  border: 'none',
  background: variant === 'primary' ? 
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
    '#f8f9fa',
  color: variant === 'primary' ? 'white' : '#374151',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  minHeight: '44px', // WCAG 2.2 requirement
  minWidth: '100px', // Wider for better UX
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  transition: 'all 0.2s ease',
}), [isMobile]);
```

### Step 5: Create Touch Target Validation Helper
```javascript
// frontend/src/utils/touchTargetValidator.js
export const validateTouchTarget = (element) => {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const minSize = 44; // WCAG 2.2 requirement
  
  return rect.width >= minSize && rect.height >= minSize;
};

// Development helper to check all interactive elements
export const auditTouchTargets = () => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const interactiveElements = document.querySelectorAll(
    'button, a, input[type="button"], input[type="submit"], [role="button"], [tabindex="0"]'
  );
  
  const violations = [];
  
  interactiveElements.forEach((element, index) => {
    if (!validateTouchTarget(element)) {
      const rect = element.getBoundingClientRect();
      violations.push({
        element,
        index,
        width: rect.width,
        height: rect.height,
        text: element.textContent || element.getAttribute('aria-label') || 'No text'
      });
    }
  });
  
  if (violations.length > 0) {
    console.warn('WCAG Touch Target Violations:', violations);
  }
  
  return violations;
};
```

## Acceptance Criteria
- [ ] All buttons have minHeight: '44px' and minWidth: '44px'
- [ ] All navigation links meet touch target requirements
- [ ] All form inputs have proper touch target size
- [ ] Modal close buttons are properly sized
- [ ] Tab buttons meet accessibility requirements
- [ ] Action buttons (edit, delete, save) are properly sized
- [ ] Search inputs and dropdowns meet requirements
- [ ] Touch targets work well on actual mobile devices
- [ ] No accessibility violations in automated testing

## Testing Steps
1. Use browser dev tools to measure interactive elements
2. Test on actual mobile devices with finger touch
3. Run accessibility audit tools (axe, Lighthouse)
4. Test with screen readers (VoiceOver, TalkBack)
5. Verify touch targets don't overlap
6. Test with users who have motor disabilities
7. Use the touch target validation helper in development

## Common Interactive Elements to Check
- Navigation menu items
- Buttons (primary, secondary, icon buttons)
- Form inputs and labels
- Links within text
- Modal close buttons
- Tab navigation
- Dropdown menus
- Search inputs
- Action buttons (edit, delete, save, cancel)
- Pagination controls

## Estimated Time
**4 hours**

## Dependencies
- Task 01: WindowSizeContext
- All existing interactive components

## Notes
- This is legally required for accessibility compliance
- Test with real users when possible
- Consider spacing between touch targets (8px minimum)
- Some elements may need larger touch targets for better UX
