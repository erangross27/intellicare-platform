# Task 06: Create FormSection Component

## 📋 Task Overview
**Epic**: Patient Schema GUI Update  
**Sprint**: Phase 2 - Country-Specific Components  
**Estimated Time**: 3 hours  
**Priority**: Medium  
**Assignee**: Developer  

## 🎯 Objective
Create a reusable FormSection component that organizes form fields into logical groups with proper styling, collapsible functionality, and accessibility features.

## 📝 Description
As a developer, I need a standardized way to organize form fields into sections so that the patient form is well-structured, visually appealing, and easy to navigate.

## ✅ Acceptance Criteria
- [ ] Create reusable FormSection component
- [ ] Support collapsible/expandable sections
- [ ] Add proper section headers with icons
- [ ] Include field count indicators
- [ ] Support required field highlighting
- [ ] Add accessibility attributes for section navigation
- [ ] Implement smooth animations for expand/collapse
- [ ] Support both LTR and RTL layouts
- [ ] Include visual hierarchy and spacing

## 🔧 Technical Requirements

### File to Create
- `frontend-vite/src/components/FormSection.js`

### Component Structure
```javascript
import React, { useState } from 'react';
import { useLanguage } from '../config/languagesStatic';

const FormSection = ({
  title,
  icon,
  children,
  collapsible = false,
  defaultExpanded = true,
  required = false,
  fieldCount,
  completedFields,
  className = '',
  id
}) => {
  const { t, isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  const completionPercentage = fieldCount > 0 ? 
    Math.round((completedFields / fieldCount) * 100) : 0;

  const sectionId = id || title.toLowerCase().replace(/\s+/g, '-');

  return (
    <div 
      className={`form-section ${className} ${isExpanded ? 'expanded' : 'collapsed'}`}
      id={sectionId}
    >
      <div 
        className={`form-section-header ${collapsible ? 'clickable' : ''}`}
        onClick={toggleExpanded}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        aria-expanded={collapsible ? isExpanded : undefined}
        aria-controls={collapsible ? `${sectionId}-content` : undefined}
      >
        <div className="section-title-container">
          {icon && <span className="section-icon" aria-hidden="true">{icon}</span>}
          <h4 className="section-title">
            {title}
            {required && <span className="required-indicator" aria-label={t('required')}>*</span>}
          </h4>
        </div>
        
        <div className="section-meta">
          {fieldCount > 0 && (
            <div className="field-progress">
              <span className="progress-text">
                {completedFields}/{fieldCount}
              </span>
              <div className="progress-bar" role="progressbar" 
                   aria-valuenow={completionPercentage} 
                   aria-valuemin="0" 
                   aria-valuemax="100"
                   aria-label={t('sectionProgress')}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {collapsible && (
            <span 
              className={`collapse-indicator ${isExpanded ? 'expanded' : 'collapsed'}`}
              aria-hidden="true"
            >
              {isRTL ? (isExpanded ? '🔽' : '🔼') : (isExpanded ? '🔽' : '🔼')}
            </span>
          )}
        </div>
      </div>

      <div 
        id={`${sectionId}-content`}
        className={`form-section-content ${isExpanded ? 'expanded' : 'collapsed'}`}
        aria-hidden={!isExpanded}
      >
        <div className="form-section-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FormSection;
```

### Usage Examples

#### Basic Information Section
```javascript
<FormSection
  title={t('basicInformation')}
  icon="👤"
  required={true}
  fieldCount={4}
  completedFields={calculateCompletedFields(['firstName', 'lastName', 'dateOfBirth', 'gender'])}
>
  <NameFields
    firstName={formData.firstName}
    lastName={formData.lastName}
    onChange={handleNameChange}
    errors={errors}
  />
  <DateOfBirthField
    value={formData.dateOfBirth}
    onChange={handleDateOfBirthChange}
    error={errors.dateOfBirth}
  />
  <GenderSelector
    value={formData.gender}
    onChange={handleGenderChange}
    error={errors.gender}
  />
</FormSection>
```

#### Contact Information Section
```javascript
<FormSection
  title={t('contactInformation')}
  icon="📞"
  collapsible={true}
  defaultExpanded={true}
  fieldCount={5}
  completedFields={calculateCompletedFields(['email', 'phone', 'street', 'city', 'zipCode'])}
>
  <div className="form-grid">
    <EmailField />
    <PhoneField />
  </div>
  <AddressFields />
</FormSection>
```

#### Identification Section
```javascript
<FormSection
  title={t('identification')}
  icon="🆔"
  required={true}
  fieldCount={getCountryFieldCount(selectedCountry)}
  completedFields={calculateCountryFieldsCompleted(selectedCountry, formData)}
>
  <CountrySelector />
  <CountrySpecificFields />
</FormSection>
```

## 🎨 CSS Requirements

### FormSection Styling
```css
.form-section {
  background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
  border-radius: 16px;
  border: 1px solid #e3e8f0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  margin-bottom: 2rem;
  overflow: hidden;
  transition: all 0.3s ease-in-out;
}

.form-section:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.form-section-header {
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s ease-in-out;
}

.form-section-header.clickable {
  cursor: pointer;
  user-select: none;
}

.form-section-header.clickable:hover {
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
}

.form-section-header.clickable:focus {
  outline: 2px solid #667eea;
  outline-offset: -2px;
}

.section-title-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-icon {
  font-size: 1.25rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.section-title {
  margin: 0;
  color: #374151;
  font-weight: 600;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.required-indicator {
  color: #dc3545;
  font-weight: bold;
  font-size: 1.1rem;
}

.section-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.field-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.progress-text {
  font-weight: 500;
  min-width: 2rem;
}

.progress-bar {
  width: 60px;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
}

.collapse-indicator {
  font-size: 1rem;
  transition: transform 0.3s ease-in-out;
  color: #6c757d;
}

.collapse-indicator.expanded {
  transform: rotate(0deg);
}

.collapse-indicator.collapsed {
  transform: rotate(-90deg);
}

.form-section-content {
  overflow: hidden;
  transition: max-height 0.3s ease-in-out, opacity 0.2s ease-in-out;
}

.form-section-content.expanded {
  max-height: 2000px;
  opacity: 1;
}

.form-section-content.collapsed {
  max-height: 0;
  opacity: 0;
}

.form-section-body {
  padding: 2rem;
}

/* Required section highlighting */
.form-section.required .section-title::after {
  content: "";
  width: 4px;
  height: 4px;
  background-color: #dc3545;
  border-radius: 50%;
  margin-left: 0.5rem;
}

/* Completion status indicators */
.form-section.completed .section-icon::after {
  content: "✅";
  position: absolute;
  font-size: 0.75rem;
  margin-left: -0.5rem;
  margin-top: -0.5rem;
}

.form-section.incomplete .progress-fill {
  background: linear-gradient(90deg, #ffc107 0%, #fd7e14 100%);
}

.form-section.empty .progress-fill {
  background: linear-gradient(90deg, #dc3545 0%, #c82333 100%);
}

/* RTL support */
[dir="rtl"] .section-title-container {
  flex-direction: row-reverse;
}

[dir="rtl"] .section-meta {
  flex-direction: row-reverse;
}

[dir="rtl"] .collapse-indicator.collapsed {
  transform: rotate(90deg);
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .form-section-header {
    padding: 1rem 1.5rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .section-meta {
    align-self: stretch;
    justify-content: space-between;
  }

  .form-section-body {
    padding: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
  }
}

/* Animation for smooth transitions */
@keyframes expandSection {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 2000px;
    opacity: 1;
  }
}

@keyframes collapseSection {
  from {
    max-height: 2000px;
    opacity: 1;
  }
  to {
    max-height: 0;
    opacity: 0;
  }
}
```

## 🧪 Testing Requirements

### Unit Tests
```javascript
describe('FormSection', () => {
  describe('Basic Rendering', () => {
    it('renders section title and icon', () => {});
    it('renders children content', () => {});
    it('applies custom className', () => {});
  });

  describe('Collapsible Functionality', () => {
    it('toggles expansion on click when collapsible', () => {});
    it('does not toggle when not collapsible', () => {});
    it('supports keyboard navigation (Enter/Space)', () => {});
    it('respects defaultExpanded prop', () => {});
  });

  describe('Progress Tracking', () => {
    it('displays correct field completion count', () => {});
    it('calculates progress percentage correctly', () => {});
    it('updates progress bar width', () => {});
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {});
    it('supports screen reader navigation', () => {});
    it('manages focus correctly', () => {});
  });

  describe('RTL Support', () => {
    it('adjusts layout for RTL languages', () => {});
    it('flips collapse indicator direction', () => {});
  });
});
```

### Integration Tests
```javascript
describe('FormSection Integration', () => {
  it('works with form validation', () => {});
  it('integrates with translation system', () => {});
  it('handles dynamic field updates', () => {});
});
```

## 📦 Dependencies
**Requires**: 
- Task 01 - Update Translation Files

**Blocks**: 
- Task 07 - Restructure PatientDetail Form Layout

**Technical Dependencies**:
- Understanding of existing form structure
- Knowledge of animation performance requirements
- Familiarity with accessibility guidelines

## ✨ Definition of Done
- [ ] FormSection component created and functional
- [ ] Collapsible functionality works smoothly
- [ ] Progress tracking displays correctly
- [ ] Accessibility attributes implemented
- [ ] Responsive design works on all screen sizes
- [ ] RTL layout supported for Hebrew
- [ ] Smooth animations implemented
- [ ] Unit tests cover all functionality
- [ ] Integration tests verify form compatibility
- [ ] Code review completed
- [ ] Performance optimized for animations

## 📚 Additional Notes

### Animation Considerations
- Use CSS transitions for better performance
- Avoid JavaScript-heavy animations
- Ensure accessibility preferences are respected
- Test on lower-end devices

### Accessibility Features
- ARIA expanded/collapsed states
- Keyboard navigation support
- Screen reader announcements
- Focus management
- Color contrast compliance

### Progressive Enhancement
- Basic functionality without JavaScript
- Graceful degradation for older browsers
- Touch device support
- Keyboard-only navigation

## 🔗 Related Tasks
- **Previous**: Task 05 - Add DateOfBirth Field Component
- **Next**: Task 07 - Restructure PatientDetail Form Layout
- **Integration**: Task 09 - Update State Management
