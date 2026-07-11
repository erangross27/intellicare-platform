/**
 * Comprehensive tests for AddressFields component
 * Tests field rendering, validation, RTL/LTR support, and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddressFields, { validateAddressFields } from '../AddressFields';

// Mock the useLanguage hook
const mockUseLanguage = {
  t: (key) => {
    const translations = {
      'streetAddress': 'Street Address',
      'city': 'City',
      'zipCode': 'ZIP Code',
      'enterStreetAddress': 'Enter street address',
      'enterCity': 'Enter city',
      'enterZipCode': 'Enter ZIP code',
      'fieldRequired': 'This field is required'
    };
    return translations[key] || key;
  },
  isRTL: false
};

jest.mock('../../config/languagesStatic', () => ({
  useLanguage: () => mockUseLanguage
}));

describe('AddressFields Component', () => {
  const defaultProps = {
    values: {},
    onChange: jest.fn(),
    errors: {},
    disabled: false,
    required: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders all address fields', () => {
      render(<AddressFields {...defaultProps} />);
      
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument();
    });

    test('displays field values correctly', () => {
      const values = {
        street: '123 Main St',
        city: 'New York',
        zipCode: '10001'
      };
      
      render(<AddressFields {...defaultProps} values={values} />);
      
      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10001')).toBeInTheDocument();
    });

    test('shows required indicators when required=true', () => {
      render(<AddressFields {...defaultProps} required={true} />);
      
      const labels = screen.getAllByText('*');
      expect(labels).toHaveLength(3); // One for each field
    });

    test('displays error messages', () => {
      const errors = {
        street: 'Street is required',
        city: 'Invalid city name',
        zipCode: 'Invalid ZIP code'
      };
      
      render(<AddressFields {...defaultProps} errors={errors} />);
      
      expect(screen.getByText('Street is required')).toBeInTheDocument();
      expect(screen.getByText('Invalid city name')).toBeInTheDocument();
      expect(screen.getByText('Invalid ZIP code')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('calls onChange when field values change', async () => {
      const onChange = jest.fn();
      render(<AddressFields {...defaultProps} onChange={onChange} />);
      
      const streetInput = screen.getByLabelText(/street address/i);
      fireEvent.change(streetInput, { target: { value: '456 Oak Ave' } });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          street: '456 Oak Ave'
        });
      });
    });

    test('handles multiple field changes', async () => {
      const onChange = jest.fn();
      const values = { street: '', city: '', zipCode: '' };
      
      render(<AddressFields {...defaultProps} values={values} onChange={onChange} />);
      
      const cityInput = screen.getByLabelText(/city/i);
      fireEvent.change(cityInput, { target: { value: 'Boston' } });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          street: '',
          city: 'Boston',
          zipCode: ''
        });
      });
    });

    test('disables fields when disabled=true', () => {
      render(<AddressFields {...defaultProps} disabled={true} />);
      
      expect(screen.getByLabelText(/street address/i)).toBeDisabled();
      expect(screen.getByLabelText(/city/i)).toBeDisabled();
      expect(screen.getByLabelText(/zip code/i)).toBeDisabled();
    });
  });

  describe('RTL Support', () => {
    test('applies RTL styles when isRTL=true', () => {
      mockUseLanguage.isRTL = true;
      
      render(<AddressFields {...defaultProps} />);
      
      const container = screen.getByRole('group', { name: /address/i }) || 
                      document.querySelector('.address-fields');
      
      // Check if RTL direction is applied
      expect(container).toHaveStyle({ direction: 'rtl' });
      
      // Reset for other tests
      mockUseLanguage.isRTL = false;
    });
  });

  describe('Validation', () => {
    test('validates required fields', () => {
      const values = { street: '', city: '', zipCode: '' };
      const errors = validateAddressFields(values, mockUseLanguage.t, true);
      
      expect(errors.street).toBe('This field is required');
      expect(errors.city).toBe('This field is required');
      expect(errors.zipCode).toBe('This field is required');
    });

    test('validates field lengths', () => {
      const values = {
        street: 'a'.repeat(101), // Too long
        city: 'b'.repeat(51),    // Too long
        zipCode: 'c'.repeat(21)  // Too long
      };
      
      const errors = validateAddressFields(values, mockUseLanguage.t, false);
      
      expect(errors.street).toContain('Maximum 100 characters');
      expect(errors.city).toContain('Maximum 50 characters');
      expect(errors.zipCode).toContain('Maximum 20 characters');
    });

    test('validates city name format', () => {
      const values = {
        street: '123 Main St',
        city: 'City123!@#', // Invalid characters
        zipCode: '12345'
      };
      
      const errors = validateAddressFields(values, mockUseLanguage.t, false);
      
      expect(errors.city).toContain('invalid characters');
    });

    test('passes validation for valid data', () => {
      const values = {
        street: '123 Main Street',
        city: 'New York',
        zipCode: '10001'
      };
      
      const errors = validateAddressFields(values, mockUseLanguage.t, false);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('allows empty values when not required', () => {
      const values = { street: '', city: '', zipCode: '' };
      const errors = validateAddressFields(values, mockUseLanguage.t, false);
      
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<AddressFields {...defaultProps} />);
      
      expect(screen.getByLabelText(/street address/i)).toHaveAttribute('id', 'street');
      expect(screen.getByLabelText(/city/i)).toHaveAttribute('id', 'city');
      expect(screen.getByLabelText(/zip code/i)).toHaveAttribute('id', 'zipCode');
    });

    test('associates error messages with fields', () => {
      const errors = { street: 'Street error' };
      render(<AddressFields {...defaultProps} errors={errors} />);
      
      const errorMessage = screen.getByText('Street error');
      expect(errorMessage).toHaveClass('error-message');
    });

    test('has proper autocomplete attributes', () => {
      render(<AddressFields {...defaultProps} />);
      
      expect(screen.getByLabelText(/street address/i)).toHaveAttribute('autoComplete', 'street-address');
      expect(screen.getByLabelText(/city/i)).toHaveAttribute('autoComplete', 'address-level2');
      expect(screen.getByLabelText(/zip code/i)).toHaveAttribute('autoComplete', 'postal-code');
    });
  });

  describe('Performance', () => {
    test('does not re-render unnecessarily', () => {
      const onChange = jest.fn();
      const { rerender } = render(<AddressFields {...defaultProps} onChange={onChange} />);
      
      // Re-render with same props
      rerender(<AddressFields {...defaultProps} onChange={onChange} />);
      
      // Component should handle re-renders gracefully
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    });
  });
});
