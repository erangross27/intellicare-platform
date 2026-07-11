# Task 03: Update LandingPage for Mobile

## Objective
Add mobile-responsive styles to LandingPage.js using inline styles with useMemo caching.

## File to Update
`frontend/src/components/LandingPage.js`

## Implementation

### Step 1: Import Mobile Detection Hook
```javascript
import { useWindowSize } from '../hooks/useWindowSize';
```

### Step 2: Add Mobile Detection
```javascript
const { isMobile, isSmallMobile, isTablet } = useWindowSize();
```

### Step 3: Update Container Styles

#### Main Container
```javascript
const containerStyle = useMemo(() => ({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  direction: textDirection,
  position: 'relative',
  overflow: 'hidden',
  padding: isMobile ? '20px 10px' : '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}), [textDirection, isMobile]);
```

#### Hero Section
```javascript
const heroSectionStyle = useMemo(() => ({
  textAlign: 'center',
  maxWidth: isMobile ? '100%' : '800px',
  margin: '0 auto',
  padding: isMobile ? '40px 0' : '60px 0',
  zIndex: 2,
  position: 'relative',
}), [isMobile]);

const heroTitleStyle = useMemo(() => ({
  fontSize: isSmallMobile ? '2rem' : isMobile ? '2.5rem' : isTablet ? '3rem' : '3.5rem',
  fontWeight: '700',
  color: '#ffffff',
  margin: '0 0 20px 0',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
  letterSpacing: '-0.5px',
  lineHeight: '1.2',
  padding: isMobile ? '0 10px' : '0',
}), [isMobile, isSmallMobile, isTablet]);

const heroSubtitleStyle = useMemo(() => ({
  fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : '1.25rem',
  color: 'rgba(255, 255, 255, 0.9)',
  margin: '0 0 30px 0',
  lineHeight: '1.6',
  fontWeight: '400',
  padding: isMobile ? '0 15px' : '0',
}), [isMobile, isSmallMobile]);
```

### Step 4: Update Button Styles

#### Button Container
```javascript
const buttonContainerStyle = useMemo(() => ({
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  gap: isMobile ? '15px' : '20px',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: '30px',
  width: isMobile ? '100%' : 'auto',
  maxWidth: isMobile ? '300px' : 'none',
  padding: isMobile ? '0 20px' : '0',
}), [isMobile]);

const primaryButtonStyle = useMemo(() => ({
  padding: isMobile ? '15px 30px' : '12px 24px',
  borderRadius: '25px',
  textDecoration: 'none',
  color: 'white',
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.25) 100%)',
  fontSize: isMobile ? '16px' : '14px',
  fontWeight: '600',
  transition: 'all 0.3s ease',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  minHeight: isMobile ? '44px' : 'auto',
  width: isMobile ? '100%' : 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}), [isMobile]);

const secondaryButtonStyle = useMemo(() => ({
  ...primaryButtonStyle,
  background: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
}), [primaryButtonStyle]);
```

### Step 5: Update Background Elements

#### Background Decorative Elements
```javascript
const backgroundElement1Style = useMemo(() => ({
  position: 'absolute',
  top: isMobile ? '5%' : '10%',
  left: isMobile ? '5%' : '15%',
  width: isMobile ? '80px' : '150px',
  height: isMobile ? '80px' : '150px',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '50%',
  pointerEvents: 'none',
  zIndex: 1,
}), [isMobile]);

const backgroundElement2Style = useMemo(() => ({
  position: 'absolute',
  top: isMobile ? '70%' : '60%',
  right: isMobile ? '5%' : '10%',
  width: isMobile ? '60px' : '120px',
  height: isMobile ? '60px' : '120px',
  background: 'rgba(255, 255, 255, 0.04)',
  borderRadius: '50%',
  pointerEvents: 'none',
  zIndex: 1,
}), [isMobile]);

const backgroundElement3Style = useMemo(() => ({
  position: 'absolute',
  bottom: isMobile ? '10%' : '15%',
  left: isMobile ? '10%' : '20%',
  width: isMobile ? '50px' : '100px',
  height: isMobile ? '50px' : '100px',
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: '50%',
  pointerEvents: 'none',
  zIndex: 1,
}), [isMobile]);
```

### Step 6: Update Features Section

#### Features Container
```javascript
const featuresContainerStyle = useMemo(() => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 
                      isMobile ? '1fr' : 
                      isTablet ? 'repeat(2, 1fr)' : 
                      'repeat(3, 1fr)',
  gap: isMobile ? '20px' : '30px',
  marginTop: isMobile ? '40px' : '60px',
  padding: isMobile ? '0 20px' : '0',
  maxWidth: '1000px',
  width: '100%',
}), [isMobile, isSmallMobile, isTablet]);

const featureCardStyle = useMemo(() => ({
  background: 'rgba(255, 255, 255, 0.1)',
  borderRadius: isMobile ? '15px' : '20px',
  padding: isMobile ? '20px' : '30px',
  textAlign: 'center',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  transition: 'transform 0.3s ease',
  cursor: 'pointer',
}), [isMobile]);

const featureIconStyle = useMemo(() => ({
  fontSize: isMobile ? '2rem' : '2.5rem',
  marginBottom: isMobile ? '15px' : '20px',
  display: 'block',
}), [isMobile]);

const featureTitleStyle = useMemo(() => ({
  fontSize: isMobile ? '1.1rem' : '1.25rem',
  fontWeight: '600',
  color: 'white',
  marginBottom: isMobile ? '10px' : '15px',
}), [isMobile]);

const featureDescriptionStyle = useMemo(() => ({
  fontSize: isMobile ? '0.9rem' : '1rem',
  color: 'rgba(255, 255, 255, 0.8)',
  lineHeight: '1.5',
}), [isMobile]);
```

### Step 7: Update Language Switcher Position

#### Language Switcher Container
```javascript
const languageSwitcherContainerStyle = useMemo(() => ({
  position: 'absolute',
  top: isMobile ? '20px' : '30px',
  right: isMobile ? '20px' : '30px',
  zIndex: 1000,
}), [isMobile]);
```

### Step 8: Add Mobile-Specific Interactions

#### Touch Feedback for Cards
```javascript
const handleFeatureCardTouch = useCallback((e) => {
  if (isMobile) {
    e.currentTarget.style.transform = 'scale(0.98)';
    setTimeout(() => {
      e.currentTarget.style.transform = 'scale(1)';
    }, 150);
  }
}, [isMobile]);
```

## Acceptance Criteria
- [ ] Hero title scales properly on all screen sizes
- [ ] Buttons stack vertically on mobile and are touch-friendly (44px min)
- [ ] Background elements scale appropriately for mobile
- [ ] Features grid adapts: 1 column on small mobile, 2 on tablet, 3 on desktop
- [ ] All text remains readable on small screens
- [ ] Language switcher positioned correctly on mobile
- [ ] Touch interactions work smoothly
- [ ] RTL layout works correctly on mobile
- [ ] All styles use useMemo for performance
- [ ] No horizontal scrolling on mobile

## Testing Steps
1. Test on desktop - should show full layout
2. Test on tablet - should show 2-column features
3. Test on mobile - should show stacked layout
4. Test on small mobile (≤480px) - should show single column
5. Test button interactions and touch feedback
6. Test Hebrew RTL layout on mobile
7. Test language switcher functionality
8. Verify no horizontal scrolling

## Estimated Time
**3 hours**

## Dependencies
- Task 01: Mobile Detection Hook
- Existing LandingPage.js component

## Notes
- Preserve all existing functionality
- Ensure smooth animations on mobile
- Test performance on older mobile devices
