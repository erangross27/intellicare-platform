# Task 04: Fix iOS Form Zoom Prevention

## Objective
Prevent iOS Safari auto-zoom on form inputs by ensuring all input fields have minimum 16px font-size.

## Critical Issue
iOS Safari automatically zooms when user focuses on input fields with font-size < 16px. This creates poor UX.

## Files to Update
1. `frontend/src/components/Login.js`
2. `frontend/src/components/Signup.js`
3. `frontend/src/components/NewVisit.js`
4. Any other components with form inputs

## Implementation

### Step 1: Update Login.js Input Styles
```javascript
import { useWindowSize } from '../context/WindowSizeContext';

const { isMobile } = useWindowSize();

const inputStyle = useMemo(() => ({
  width: '100%',
  padding: isMobile ? '15px' : '12px',
  fontSize: '16px', // CRITICAL: Never less than 16px for iOS
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  marginBottom: '15px',
  minHeight: '44px', // WCAG 2.2 touch target requirement
  WebkitAppearance: 'none', // Remove iOS default styling
  appearance: 'none',
  backgroundColor: '#ffffff',
  color: '#111827',
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
}), [isMobile]);

const buttonStyle = useMemo(() => ({
  width: '100%',
  padding: isMobile ? '15px' : '12px',
  fontSize: '16px', // Consistent with inputs
  minHeight: '44px', // WCAG 2.2 requirement
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '600',
  touchAction: 'manipulation', // Improves touch response
  transition: 'all 0.3s ease',
}), [isMobile]);
```

### Step 2: Update Signup.js Input Styles
```javascript
// Same pattern as Login.js
const inputStyle = useMemo(() => ({
  width: '100%',
  padding: isMobile ? '15px' : '12px',
  fontSize: '16px', // CRITICAL: Prevents iOS zoom
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  marginBottom: '15px',
  minHeight: '44px',
  WebkitAppearance: 'none',
  appearance: 'none',
  backgroundColor: '#ffffff',
}), [isMobile]);

// For select dropdowns
const selectStyle = useMemo(() => ({
  ...inputStyle,
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '16px',
  paddingRight: '40px',
}), [inputStyle]);
```

### Step 3: Update NewVisit.js Form Styles
```javascript
const formInputStyle = useMemo(() => ({
  width: '100%',
  padding: isMobile ? '15px' : '12px',
  fontSize: '16px', // CRITICAL: Prevents iOS zoom
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  marginBottom: '15px',
  minHeight: '44px',
  WebkitAppearance: 'none',
  appearance: 'none',
  resize: 'vertical', // For textareas
}), [isMobile]);

const textareaStyle = useMemo(() => ({
  ...formInputStyle,
  minHeight: isMobile ? '120px' : '100px',
  fontFamily: 'inherit',
  lineHeight: '1.5',
}), [formInputStyle, isMobile]);
```

### Step 4: Create Reusable Input Component (Optional)
```javascript
// frontend/src/components/MobileInput.js
import React, { useMemo } from 'react';
import { useWindowSize } from '../context/WindowSizeContext';

const MobileInput = ({ 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  style = {},
  ...props 
}) => {
  const { isMobile } = useWindowSize();
  
  const inputStyle = useMemo(() => ({
    width: '100%',
    padding: isMobile ? '15px' : '12px',
    fontSize: '16px', // CRITICAL: Prevents iOS zoom
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    minHeight: '44px',
    WebkitAppearance: 'none',
    appearance: 'none',
    backgroundColor: '#ffffff',
    color: '#111827',
    ...style, // Allow style overrides
  }), [isMobile, style]);

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={inputStyle}
      {...props}
    />
  );
};

export default MobileInput;
```

### Step 5: Update All Form JSX
```javascript
// Replace all input elements with proper styles
<input
  type="email"
  name="email"
  placeholder={t('email')}
  value={formData.email}
  onChange={handleChange}
  style={inputStyle}
  required
  autoComplete="email"
/>

<input
  type="password"
  name="password"
  placeholder={t('password')}
  value={formData.password}
  onChange={handleChange}
  style={inputStyle}
  required
  autoComplete="current-password"
/>

<button
  type="submit"
  style={buttonStyle}
  disabled={loading}
>
  {loading ? t('loading') : t('login')}
</button>
```

## Acceptance Criteria
- [ ] All input fields have fontSize: '16px' minimum
- [ ] All buttons have minHeight: '44px'
- [ ] iOS Safari does not zoom when focusing inputs
- [ ] All inputs have proper WebkitAppearance: 'none'
- [ ] Form submission works correctly on mobile
- [ ] Inputs are accessible with screen readers
- [ ] Hebrew RTL layout works correctly
- [ ] All styles use useMemo for performance

## Testing Steps
1. Test on iOS Safari (real device or simulator)
2. Focus on each input field - should not zoom
3. Test form submission on mobile
4. Test with Hebrew language/RTL layout
5. Test accessibility with VoiceOver (iOS)
6. Test on Android Chrome for comparison
7. Verify no zoom on any input type (text, email, password, select)

## Common Input Types to Fix
- `type="text"`
- `type="email"`
- `type="password"`
- `type="tel"`
- `type="search"`
- `<select>` elements
- `<textarea>` elements

## Estimated Time
**2 hours**

## Dependencies
- Task 01: WindowSizeContext
- Existing form components

## Notes
- This is CRITICAL for iOS user experience
- 16px is the magic number - never go below this
- Test on real iOS devices, not just browser dev tools
- Consider creating reusable input components for consistency
