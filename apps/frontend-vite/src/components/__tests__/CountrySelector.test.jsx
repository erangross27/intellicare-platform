/**
 * Comprehensive tests for CountrySelector component
 * Tests country selection, flags, translations, and CountryDisplay component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CountrySelector, { CountryDisplay } from '../CountrySelector';

// Mock the useLanguage hook
const mockUseLanguage = {
  t: (key) => {
    const translations = {
      'country': 'Country',
      'selectCountry': 'Select Country',
      'israel': 'Israel',
      'unitedstates': 'United States',
      'canada': 'Canada',
      'unitedkingdom': 'United Kingdom',
      'notProvided': 'Not Provided'
    };
    return translations[key] || key;
  },
  isRTL: false
};

// Mock the countryConfig utility
jest.mock('../../utils/countryConfig', () => ({
  getSupportedCountries: () => [
    'Israel', 'United States', 'Canada', 'United Kingdom', 'Germany',
    'France', 'Spain', 'Brazil', 'Argentina', 'Japan', 'South Korea',
    'Australia', 'New Zealand'
  ],
  getCountryConfig: (country) => ({
    country,
    countryCode: country === 'Israel' ? 'IL' : 'US',
    fields: {}
  })
}));

jest.mock('../../config/languagesStatic', () => ({
  useLanguage: () => mockUseLanguage
}));

describe('CountrySelector Component', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    disabled: false,
    required: true,
    showFlag: true,
    size: 'medium'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders country selector with label', () => {
      render(<CountrySelector {...defaultProps} />);
      
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
      expect(screen.getByText('Country *')).toBeInTheDocument();
    });

    test('shows placeholder when no country selected', () => {
      render(<CountrySelector {...defaultProps} />);
      
      expect(screen.getByDisplayValue('Select Country')).toBeInTheDocument();
    });

    test('renders all supported countries', () => {
      render(<CountrySelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/country/i);
      expect(select).toBeInTheDocument();
      
      // Check if major countries are present
      expect(screen.getByRole('option', { name: /israel/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /united states/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /canada/i })).toBeInTheDocument();
    });

    test('displays country flags when showFlag=true', () => {
      render(<CountrySelector {...defaultProps} showFlag={true} />);
      
      // Check if flag emojis are present in options
      const israelOption = screen.getByRole('option', { name: /🇮🇱.*israel/i });
      expect(israelOption).toBeInTheDocument();
    });

    test('hides country flags when showFlag=false', () => {
      render(<CountrySelector {...defaultProps} showFlag={false} />);
      
      // Check if options don't contain flag emojis
      const israelOption = screen.getByRole('option', { name: /^israel$/i });
      expect(israelOption).toBeInTheDocument();
    });

    test('applies correct size styling', () => {
      const { rerender } = render(<CountrySelector {...defaultProps} size="small" />);
      
      let select = screen.getByLabelText(/country/i);
      expect(select).toHaveStyle({ fontSize: '0.875rem' });
      
      rerender(<CountrySelector {...defaultProps} size="large" />);
      select = screen.getByLabelText(/country/i);
      expect(select).toHaveStyle({ fontSize: '1.125rem' });
    });

    test('shows required indicator when required=true', () => {
      render(<CountrySelector {...defaultProps} required={true} />);
      
      expect(screen.getByText('Country *')).toBeInTheDocument();
    });

    test('hides required indicator when required=false', () => {
      render(<CountrySelector {...defaultProps} required={false} />);
      
      expect(screen.getByText('Country')).toBeInTheDocument();
      expect(screen.queryByText('Country *')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('calls onChange with country and config data', async () => {
      const onChange = jest.fn();
      render(<CountrySelector {...defaultProps} onChange={onChange} />);
      
      const select = screen.getByLabelText(/country/i);
      fireEvent.change(select, { target: { value: 'Israel' } });
      
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('Israel', {
          countryCode: 'IL',
          fields: {},
          config: {
            country: 'Israel',
            countryCode: 'IL',
            fields: {}
          }
        });
      });
    });

    test('does not call onChange when disabled', () => {
      const onChange = jest.fn();
      render(<CountrySelector {...defaultProps} onChange={onChange} disabled={true} />);
      
      const select = screen.getByLabelText(/country/i);
      expect(select).toBeDisabled();
      
      fireEvent.change(select, { target: { value: 'Israel' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    test('displays selected country correctly', () => {
      render(<CountrySelector {...defaultProps} value="Israel" />);
      
      expect(screen.getByDisplayValue(/israel/i)).toBeInTheDocument();
    });
  });

  describe('Country Sorting', () => {
    test('sorts countries alphabetically by translated name', () => {
      render(<CountrySelector {...defaultProps} />);
      
      const options = screen.getAllByRole('option');
      const countryOptions = options.slice(1); // Skip placeholder option
      
      // Check if countries are in alphabetical order
      const countryNames = countryOptions.map(option => option.textContent);
      const sortedNames = [...countryNames].sort();
      
      expect(countryNames).toEqual(sortedNames);
    });
  });

  describe('RTL Support', () => {
    test('applies RTL styles when isRTL=true', () => {
      mockUseLanguage.isRTL = true;
      
      render(<CountrySelector {...defaultProps} />);
      
      const container = screen.getByLabelText(/country/i).closest('.country-selector');
      expect(container).toHaveStyle({ direction: 'rtl' });
      
      // Reset for other tests
      mockUseLanguage.isRTL = false;
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<CountrySelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/country/i);
      expect(select).toHaveAttribute('id', 'country');
      expect(select).toHaveAttribute('name', 'country');
      expect(select).toHaveAttribute('required');
    });

    test('supports keyboard navigation', () => {
      render(<CountrySelector {...defaultProps} />);
      
      const select = screen.getByLabelText(/country/i);
      select.focus();
      expect(select).toHaveFocus();
    });
  });
});

describe('CountryDisplay Component', () => {
  const defaultProps = {
    country: 'Israel',
    showFlag: true,
    size: 'medium'
  };

  describe('Rendering', () => {
    test('renders country display with flag and name', () => {
      render(<CountryDisplay {...defaultProps} />);
      
      expect(screen.getByText('🇮🇱')).toBeInTheDocument();
      expect(screen.getByText('Israel')).toBeInTheDocument();
    });

    test('renders without flag when showFlag=false', () => {
      render(<CountryDisplay {...defaultProps} showFlag={false} />);
      
      expect(screen.getByText('Israel')).toBeInTheDocument();
      expect(screen.queryByText('🇮🇱')).not.toBeInTheDocument();
    });

    test('handles empty country gracefully', () => {
      render(<CountryDisplay country="" />);
      
      expect(screen.getByText('Not Provided')).toBeInTheDocument();
    });

    test('handles undefined country gracefully', () => {
      render(<CountryDisplay country={undefined} />);
      
      expect(screen.getByText('Not Provided')).toBeInTheDocument();
    });

    test('applies correct size styling', () => {
      const { rerender } = render(<CountryDisplay {...defaultProps} size="small" />);
      
      let display = screen.getByText('Israel').closest('.country-display');
      expect(display).toHaveStyle({ fontSize: '0.875rem' });
      
      rerender(<CountryDisplay {...defaultProps} size="large" />);
      display = screen.getByText('Israel').closest('.country-display');
      expect(display).toHaveStyle({ fontSize: '1.125rem' });
    });

    test('uses translated country names', () => {
      render(<CountryDisplay country="United States" />);
      
      // Should use translation if available
      expect(screen.getByText('United States')).toBeInTheDocument();
    });
  });

  describe('Country Flags', () => {
    test('displays correct flags for different countries', () => {
      const { rerender } = render(<CountryDisplay country="Israel" showFlag={true} />);
      expect(screen.getByText('🇮🇱')).toBeInTheDocument();
      
      rerender(<CountryDisplay country="United States" showFlag={true} />);
      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
      
      rerender(<CountryDisplay country="Canada" showFlag={true} />);
      expect(screen.getByText('🇨🇦')).toBeInTheDocument();
    });
  });
});
