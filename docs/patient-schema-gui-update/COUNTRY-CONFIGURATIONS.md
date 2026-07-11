# Country Configuration Specifications

## Overview
This document defines the exact field configurations for each of the 13 supported countries in the PatientSchemaFactory.js schema.

## Universal Fields (All Countries)
```javascript
const universalFields = {
  firstName: { required: true, type: 'text', maxLength: 50 },
  lastName: { required: true, type: 'text', maxLength: 50 },
  dateOfBirth: { required: true, type: 'date' },
  email: { required: false, type: 'email', maxLength: 100 },
  phone: { required: false, type: 'tel', maxLength: 20 },
  street: { required: false, type: 'text', maxLength: 100 },
  city: { required: false, type: 'text', maxLength: 50 },
  zipCode: { required: false, type: 'text', maxLength: 20 },
  status: { required: true, type: 'select', options: ['active', 'inactive', 'archived'], default: 'active' },
  doctorSummary: { required: false, type: 'textarea', maxLength: 2000 }
};
```

## Country-Specific Configurations

### 🇮🇱 Israel
```javascript
const israelConfig = {
  country: 'Israel',
  fields: {
    nationalId: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{9}$',
      maxLength: 9,
      minLength: 9,
      label: 'National ID',
      labelHe: 'תעודת זהות',
      placeholder: '123456789',
      helpText: '9-digit Israeli ID number',
      helpTextHe: 'מספר תעודת זהות 9 ספרות',
      validation: 'israeliId'
    },
    healthFund: {
      required: true,
      type: 'select',
      options: ['מכבי', 'כללית', 'מאוחדת', 'לאומית'],
      label: 'Health Fund',
      labelHe: 'קופת חולים',
      helpText: 'Israeli health fund provider',
      helpTextHe: 'קופת חולים בישראל'
    }
  }
};
```

### 🇺🇸 United States
```javascript
const usConfig = {
  country: 'United States',
  fields: {
    socialSecurityNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$',
      maxLength: 11,
      label: 'Social Security Number',
      labelHe: 'מספר ביטוח לאומי',
      placeholder: '123-45-6789',
      helpText: 'Format: XXX-XX-XXXX',
      helpTextHe: 'פורמט: XXX-XX-XXXX',
      validation: 'ssn'
    },
    insuranceProvider: {
      required: false,
      type: 'text',
      maxLength: 100,
      label: 'Insurance Provider',
      labelHe: 'ספק ביטוח',
      placeholder: 'Blue Cross Blue Shield',
      helpText: 'Health insurance company name',
      helpTextHe: 'שם חברת הביטוח'
    }
  }
};
```

### 🇨🇦 Canada
```javascript
const canadaConfig = {
  country: 'Canada',
  fields: {
    healthCardNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{10}$',
      maxLength: 10,
      label: 'Health Card Number',
      labelHe: 'מספר כרטיס בריאות',
      placeholder: '1234567890',
      helpText: '10-digit provincial health card number',
      helpTextHe: 'מספר כרטיס בריאות מחוזי 10 ספרות',
      validation: 'canadianHealthCard'
    },
    province: {
      required: true,
      type: 'select',
      options: [
        'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
        'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
        'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'
      ],
      label: 'Province/Territory',
      labelHe: 'מחוז/טריטוריה',
      helpText: 'Canadian province or territory',
      helpTextHe: 'מחוז או טריטוריה קנדית'
    }
  }
};
```

### 🇬🇧 United Kingdom
```javascript
const ukConfig = {
  country: 'United Kingdom',
  fields: {
    nhsNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{3} [0-9]{3} [0-9]{4}$',
      maxLength: 12,
      label: 'NHS Number',
      labelHe: 'מספר NHS',
      placeholder: '123 456 7890',
      helpText: 'Format: XXX XXX XXXX',
      helpTextHe: 'פורמט: XXX XXX XXXX',
      validation: 'nhsNumber'
    }
  }
};
```

### 🇩🇪 Germany
```javascript
const germanyConfig = {
  country: 'Germany',
  fields: {
    healthInsuranceNumber: {
      required: true,
      type: 'text',
      pattern: '^[A-Z][0-9]{9}$',
      maxLength: 10,
      label: 'Health Insurance Number',
      labelHe: 'מספר ביטוח בריאות',
      placeholder: 'A123456789',
      helpText: 'Format: Letter + 9 digits',
      helpTextHe: 'פורמט: אות + 9 ספרות',
      validation: 'germanHealthInsurance'
    },
    insuranceProvider: {
      required: false,
      type: 'text',
      maxLength: 100,
      label: 'Insurance Provider',
      labelHe: 'ספק ביטוח',
      placeholder: 'AOK',
      helpText: 'German health insurance company',
      helpTextHe: 'חברת ביטוח בריאות גרמנית'
    }
  }
};
```

### 🇫🇷 France
```javascript
const franceConfig = {
  country: 'France',
  fields: {
    socialSecurityNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{13}$',
      maxLength: 13,
      label: 'Social Security Number',
      labelHe: 'מספר ביטוח לאומי',
      placeholder: '1234567890123',
      helpText: '13-digit social security number',
      helpTextHe: 'מספר ביטוח לאומי 13 ספרות',
      validation: 'frenchSocialSecurity'
    },
    vitaleCardNumber: {
      required: false,
      type: 'text',
      pattern: '^[0-9]{15}$',
      maxLength: 15,
      label: 'Vitale Card Number',
      labelHe: 'מספר כרטיס ויטאל',
      placeholder: '123456789012345',
      helpText: '15-digit Carte Vitale number',
      helpTextHe: 'מספר כרטיס ויטאל 15 ספרות'
    }
  }
};
```

### 🇪🇸 Spain
```javascript
const spainConfig = {
  country: 'Spain',
  fields: {
    healthCardNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{12}$',
      maxLength: 12,
      label: 'Health Card Number',
      labelHe: 'מספר כרטיס בריאות',
      placeholder: '123456789012',
      helpText: '12-digit health card number',
      helpTextHe: 'מספר כרטיס בריאות 12 ספרות',
      validation: 'spanishHealthCard'
    },
    autonomousCommunity: {
      required: false,
      type: 'select',
      options: [
        'Andalusia', 'Aragon', 'Asturias', 'Balearic Islands', 'Basque Country',
        'Canary Islands', 'Cantabria', 'Castile and León', 'Castile-La Mancha',
        'Catalonia', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid',
        'Murcia', 'Navarre', 'Valencia', 'Ceuta', 'Melilla'
      ],
      label: 'Autonomous Community',
      labelHe: 'קהילה אוטונומית',
      helpText: 'Spanish autonomous community',
      helpTextHe: 'קהילה אוטונומית ספרדית'
    }
  }
};
```

### 🇧🇷 Brazil
```javascript
const brazilConfig = {
  country: 'Brazil',
  fields: {
    cpfNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}$',
      maxLength: 14,
      label: 'CPF Number',
      labelHe: 'מספר CPF',
      placeholder: '123.456.789-01',
      helpText: 'Format: XXX.XXX.XXX-XX',
      helpTextHe: 'פורמט: XXX.XXX.XXX-XX',
      validation: 'brazilianCpf'
    },
    susNumber: {
      required: false,
      type: 'text',
      pattern: '^[0-9]{15}$',
      maxLength: 15,
      label: 'SUS Number',
      labelHe: 'מספר SUS',
      placeholder: '123456789012345',
      helpText: '15-digit SUS card number',
      helpTextHe: 'מספר כרטיס SUS 15 ספרות'
    },
    state: {
      required: false,
      type: 'select',
      options: [
        'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
        'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão',
        'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará',
        'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
        'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
        'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
      ],
      label: 'State',
      labelHe: 'מדינה',
      helpText: 'Brazilian state',
      helpTextHe: 'מדינה ברזילאית'
    }
  }
};
```

### 🇦🇷 Argentina
```javascript
const argentinaConfig = {
  country: 'Argentina',
  fields: {
    nationalIdNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{8}$',
      maxLength: 8,
      label: 'National ID Number (DNI)',
      labelHe: 'מספר זהות לאומי (DNI)',
      placeholder: '12345678',
      helpText: '8-digit DNI number',
      helpTextHe: 'מספר DNI 8 ספרות',
      validation: 'argentinianDni'
    },
    healthInsuranceProvider: {
      required: false,
      type: 'text',
      maxLength: 100,
      label: 'Health Insurance Provider',
      labelHe: 'ספק ביטוח בריאות',
      placeholder: 'OSDE',
      helpText: 'Argentine health insurance company',
      helpTextHe: 'חברת ביטוח בריאות ארגנטינית'
    },
    province: {
      required: false,
      type: 'select',
      options: [
        'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
        'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
        'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
        'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
        'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
        'Ciudad Autónoma de Buenos Aires'
      ],
      label: 'Province',
      labelHe: 'מחוז',
      helpText: 'Argentine province',
      helpTextHe: 'מחוז ארגנטינאי'
    }
  }
};
```

### 🇯🇵 Japan
```javascript
const japanConfig = {
  country: 'Japan',
  fields: {
    healthInsuranceNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{8}$',
      maxLength: 8,
      label: 'Health Insurance Number',
      labelHe: 'מספר ביטוח בריאות',
      placeholder: '12345678',
      helpText: '8-digit health insurance number',
      helpTextHe: 'מספר ביטוח בריאות 8 ספרות',
      validation: 'japaneseHealthInsurance'
    },
    prefecture: {
      required: false,
      type: 'select',
      options: [
        'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata',
        'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba',
        'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui',
        'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie',
        'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama',
        'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
        'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga',
        'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'
      ],
      label: 'Prefecture',
      labelHe: 'מחוז',
      helpText: 'Japanese prefecture',
      helpTextHe: 'מחוז יפני'
    },
    insuranceType: {
      required: false,
      type: 'select',
      options: ['National Health Insurance', 'Employee Health Insurance', 'Mutual Aid Insurance'],
      label: 'Insurance Type',
      labelHe: 'סוג ביטוח',
      helpText: 'Type of health insurance',
      helpTextHe: 'סוג ביטוח בריאות'
    }
  }
};
```

### 🇰🇷 South Korea
```javascript
const southKoreaConfig = {
  country: 'South Korea',
  fields: {
    residentRegistrationNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{6}-[0-9]{7}$',
      maxLength: 14,
      label: 'Resident Registration Number',
      labelHe: 'מספר רישום תושב',
      placeholder: '123456-1234567',
      helpText: 'Format: YYMMDD-NNNNNNN',
      helpTextHe: 'פורמט: YYMMDD-NNNNNNN',
      validation: 'koreanResidentRegistration'
    },
    nationalHealthInsuranceNumber: {
      required: false,
      type: 'text',
      pattern: '^[0-9]{11}$',
      maxLength: 11,
      label: 'National Health Insurance Number',
      labelHe: 'מספר ביטוח בריאות לאומי',
      placeholder: '12345678901',
      helpText: '11-digit health insurance number',
      helpTextHe: 'מספר ביטוח בריאות 11 ספרות'
    }
  }
};
```

### 🇦🇺 Australia
```javascript
const australiaConfig = {
  country: 'Australia',
  fields: {
    medicareNumber: {
      required: true,
      type: 'text',
      pattern: '^[0-9]{10}$',
      maxLength: 10,
      label: 'Medicare Number',
      labelHe: 'מספר מדיקר',
      placeholder: '1234567890',
      helpText: '10-digit Medicare number',
      helpTextHe: 'מספר מדיקר 10 ספרות',
      validation: 'australianMedicare'
    },
    state: {
      required: false,
      type: 'select',
      options: [
        'Australian Capital Territory', 'New South Wales', 'Northern Territory',
        'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'
      ],
      label: 'State/Territory',
      labelHe: 'מדינה/טריטוריה',
      helpText: 'Australian state or territory',
      helpTextHe: 'מדינה או טריטוריה אוסטרלית'
    },
    indigenousStatus: {
      required: false,
      type: 'select',
      options: ['Aboriginal', 'Torres Strait Islander', 'Both Aboriginal and Torres Strait Islander', 'Neither'],
      label: 'Indigenous Status',
      labelHe: 'מעמד ילידי',
      helpText: 'Indigenous Australian status',
      helpTextHe: 'מעמד ילידי אוסטרלי'
    }
  }
};
```

### 🇳🇿 New Zealand
```javascript
const newZealandConfig = {
  country: 'New Zealand',
  fields: {
    nationalHealthIndexNumber: {
      required: true,
      type: 'text',
      pattern: '^[A-Z]{3}[0-9]{4}$',
      maxLength: 7,
      label: 'National Health Index Number',
      labelHe: 'מספר אינדקס בריאות לאומי',
      placeholder: 'ABC1234',
      helpText: 'Format: 3 letters + 4 digits',
      helpTextHe: 'פורמט: 3 אותיות + 4 ספרות',
      validation: 'newZealandNhi'
    },
    ethnicity: {
      required: false,
      type: 'select',
      options: [
        'New Zealand European', 'Māori', 'Pacific Peoples', 'Asian',
        'Middle Eastern/Latin American/African', 'Other Ethnicity'
      ],
      label: 'Ethnicity',
      labelHe: 'מוצא אתני',
      helpText: 'Primary ethnicity',
      helpTextHe: 'מוצא אתני עיקרי'
    }
  }
};
```

## Configuration Helper Functions

```javascript
// Get configuration for a specific country
export const getCountryConfig = (countryName) => {
  const configs = {
    'Israel': israelConfig,
    'United States': usConfig,
    'Canada': canadaConfig,
    'United Kingdom': ukConfig,
    'Germany': germanyConfig,
    'France': franceConfig,
    'Spain': spainConfig,
    'Brazil': brazilConfig,
    'Argentina': argentinaConfig,
    'Japan': japanConfig,
    'South Korea': southKoreaConfig,
    'Australia': australiaConfig,
    'New Zealand': newZealandConfig
  };
  
  return configs[countryName] || null;
};

// Get all supported countries
export const getSupportedCountries = () => {
  return [
    'Israel', 'United States', 'Canada', 'United Kingdom', 'Germany',
    'France', 'Spain', 'Brazil', 'Argentina', 'Japan', 'South Korea',
    'Australia', 'New Zealand'
  ];
};

// Get fields for a specific country
export const getCountryFields = (countryName) => {
  const config = getCountryConfig(countryName);
  return config ? config.fields : {};
};

// Get required fields for a country
export const getRequiredFields = (countryName) => {
  const fields = getCountryFields(countryName);
  return Object.keys(fields).filter(fieldName => fields[fieldName].required);
};
```

## Validation Functions

```javascript
// Israeli ID validation
export const validateIsraeliId = (id) => {
  if (!/^[0-9]{9}$/.test(id)) return false;
  
  const digits = id.split('').map(Number);
  const checksum = digits.reduce((sum, digit, index) => {
    const multiplier = (index % 2) + 1;
    const product = digit * multiplier;
    return sum + (product > 9 ? product - 9 : product);
  }, 0);
  
  return checksum % 10 === 0;
};

// US SSN validation
export const validateSSN = (ssn) => {
  return /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/.test(ssn);
};

// Additional validation functions for other countries...
```
