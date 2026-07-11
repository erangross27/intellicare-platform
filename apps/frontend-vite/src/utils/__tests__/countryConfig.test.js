/**
 * Unit tests for countryConfig.js
 * Tests country-specific field configurations, validation rules, and utility functions
 */

import {
  getSupportedCountries,
  getCountryConfig,
  getCountryFields,
  getRequiredFields,
  getOptionalFields,
  validateField,
  getFieldError
} from '../countryConfig';

// Mock translation function
const mockT = (key) => {
  const translations = {
    'fieldRequired': 'This field is required',
    'invalidFormat': 'Invalid format'
  };
  return translations[key] || key;
};

describe('countryConfig', () => {
  describe('getSupportedCountries', () => {
    test('should return all 13 supported countries', () => {
      const countries = getSupportedCountries();
      expect(countries).toHaveLength(13);
      expect(countries).toContain('Israel');
      expect(countries).toContain('United States');
      expect(countries).toContain('Canada');
      expect(countries).toContain('United Kingdom');
      expect(countries).toContain('Germany');
      expect(countries).toContain('France');
      expect(countries).toContain('Spain');
      expect(countries).toContain('Brazil');
      expect(countries).toContain('Argentina');
      expect(countries).toContain('Japan');
      expect(countries).toContain('South Korea');
      expect(countries).toContain('Australia');
      expect(countries).toContain('New Zealand');
    });
  });

  describe('getCountryConfig', () => {
    test('should return config for valid country', () => {
      const config = getCountryConfig('Israel');
      expect(config).toBeDefined();
      expect(config.country).toBe('Israel');
      expect(config.countryCode).toBe('IL');
      expect(config.fields).toBeDefined();
    });

    test('should return null for invalid country', () => {
      const config = getCountryConfig('InvalidCountry');
      expect(config).toBeNull();
    });
  });

  describe('getCountryFields', () => {
    test('should return fields for Israel', () => {
      const fields = getCountryFields('Israel');
      expect(fields).toHaveProperty('nationalId');
      expect(fields).toHaveProperty('healthFund');
      expect(fields.nationalId.required).toBe(true);
      expect(fields.healthFund.required).toBe(true);
    });

    test('should return fields for United States', () => {
      const fields = getCountryFields('United States');
      expect(fields).toHaveProperty('socialSecurityNumber');
      expect(fields).toHaveProperty('insuranceProvider');
      expect(fields.socialSecurityNumber.required).toBe(true);
      expect(fields.insuranceProvider.required).toBe(false);
    });

    test('should return empty object for invalid country', () => {
      const fields = getCountryFields('InvalidCountry');
      expect(fields).toEqual({});
    });
  });

  describe('getRequiredFields', () => {
    test('should return required fields for Israel', () => {
      const requiredFields = getRequiredFields('Israel');
      expect(requiredFields).toContain('nationalId');
      expect(requiredFields).toContain('healthFund');
      expect(requiredFields).toHaveLength(2);
    });

    test('should return required fields for United States', () => {
      const requiredFields = getRequiredFields('United States');
      expect(requiredFields).toContain('socialSecurityNumber');
      expect(requiredFields).not.toContain('insuranceProvider');
      expect(requiredFields).toHaveLength(1);
    });
  });

  describe('getOptionalFields', () => {
    test('should return optional fields for United States', () => {
      const optionalFields = getOptionalFields('United States');
      expect(optionalFields).toContain('insuranceProvider');
      expect(optionalFields).not.toContain('socialSecurityNumber');
    });

    test('should return optional fields for Canada', () => {
      const optionalFields = getOptionalFields('Canada');
      expect(optionalFields).toHaveLength(0); // Canada has all required fields
    });
  });

  describe('validateField', () => {
    test('should validate Israeli national ID correctly', () => {
      expect(validateField('Israel', 'nationalId', '123456789')).toBe(true);
      expect(validateField('Israel', 'nationalId', '12345678')).toBe(false); // too short
      expect(validateField('Israel', 'nationalId', '1234567890')).toBe(false); // too long
      expect(validateField('Israel', 'nationalId', '12345678a')).toBe(false); // contains letter
      expect(validateField('Israel', 'nationalId', '')).toBe(false); // required field empty
    });

    test('should validate US SSN correctly', () => {
      expect(validateField('United States', 'socialSecurityNumber', '123-45-6789')).toBe(true);
      expect(validateField('United States', 'socialSecurityNumber', '123456789')).toBe(false); // no dashes
      expect(validateField('United States', 'socialSecurityNumber', '123-45-678')).toBe(false); // too short
      expect(validateField('United States', 'socialSecurityNumber', '')).toBe(false); // required field empty
    });

    test('should validate UK NHS number correctly', () => {
      expect(validateField('United Kingdom', 'nhsNumber', '123 456 7890')).toBe(true);
      expect(validateField('United Kingdom', 'nhsNumber', '1234567890')).toBe(false); // no spaces
      expect(validateField('United Kingdom', 'nhsNumber', '123 456 789')).toBe(false); // too short
    });

    test('should return true for non-existent field', () => {
      expect(validateField('Israel', 'nonExistentField', 'any value')).toBe(true);
    });

    test('should allow empty values for optional fields', () => {
      expect(validateField('United States', 'insuranceProvider', '')).toBe(true);
      expect(validateField('United States', 'insuranceProvider', 'Blue Cross')).toBe(true);
    });
  });

  describe('getFieldError', () => {
    test('should return error for required field when empty', () => {
      const error = getFieldError('Israel', 'nationalId', '', mockT);
      expect(error).toBe('This field is required');
    });

    test('should return error for invalid format', () => {
      const error = getFieldError('Israel', 'nationalId', '12345678a', mockT);
      expect(error).toBe('Invalid format');
    });

    test('should return null for valid field', () => {
      const error = getFieldError('Israel', 'nationalId', '123456789', mockT);
      expect(error).toBeNull();
    });

    test('should return null for non-existent field', () => {
      const error = getFieldError('Israel', 'nonExistentField', 'any value', mockT);
      expect(error).toBeNull();
    });

    test('should return length error for too long value', () => {
      const longValue = 'a'.repeat(101);
      const error = getFieldError('United States', 'insuranceProvider', longValue, mockT);
      expect(error).toContain('Maximum 100 characters allowed');
    });
  });

  describe('Country-specific field configurations', () => {
    test('should have correct field types for all countries', () => {
      const countries = getSupportedCountries();
      countries.forEach(country => {
        const fields = getCountryFields(country);
        Object.values(fields).forEach(field => {
          expect(['text', 'select']).toContain(field.type);
          expect(field.label).toBeDefined();
        });
      });
    });

    test('should have select options for dropdown fields', () => {
      const israelFields = getCountryFields('Israel');
      expect(israelFields.healthFund.type).toBe('select');
      expect(israelFields.healthFund.options).toHaveLength(4);
      expect(israelFields.healthFund.options).toContain('מכבי');

      const canadaFields = getCountryFields('Canada');
      expect(canadaFields.province.type).toBe('select');
      expect(canadaFields.province.options.length).toBeGreaterThan(10);
    });

    test('should have proper validation patterns', () => {
      const usFields = getCountryFields('United States');
      expect(usFields.socialSecurityNumber.pattern).toBe('^[0-9]{3}-[0-9]{2}-[0-9]{4}$');

      const ukFields = getCountryFields('United Kingdom');
      expect(ukFields.nhsNumber.pattern).toBe('^[0-9]{3} [0-9]{3} [0-9]{4}$');
    });
  });
});
