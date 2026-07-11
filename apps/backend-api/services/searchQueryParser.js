class SearchQueryParser {
  constructor() {
    this.medicalConditions = [
      'diabetes', 'hypertension', 'leukemia', 'cancer', 'asthma',
      'copd', 'heart disease', 'kidney disease', 'liver disease',
      'pneumonia', 'bronchitis', 'arthritis', 'osteoporosis',
      'depression', 'anxiety', 'bipolar', 'schizophrenia',
      'alzheimer', 'parkinson', 'epilepsy', 'stroke', 'migraine',
      'covid', 'influenza', 'tuberculosis', 'hiv', 'aids',
      'obesity', 'anemia', 'thyroid', 'lupus', 'fibromyalgia'
    ];

    this.commonMedications = [
      'metformin', 'insulin', 'lisinopril', 'atorvastatin', 'simvastatin',
      'aspirin', 'ibuprofen', 'acetaminophen', 'tylenol', 'advil',
      'amoxicillin', 'penicillin', 'levothyroxine', 'omeprazole',
      'losartan', 'metoprolol', 'amlodipine', 'albuterol', 'warfarin',
      'prednisone', 'gabapentin', 'hydrocodone', 'tramadol',
      'sertraline', 'fluoxetine', 'citalopram', 'escitalopram',
      'alprazolam', 'lorazepam', 'diazepam', 'zolpidem'
    ];

    this.commonAllergies = [
      'penicillin', 'amoxicillin', 'sulfa', 'aspirin', 'nsaid',
      'peanuts', 'tree nuts', 'milk', 'eggs', 'wheat', 'soy',
      'fish', 'shellfish', 'latex', 'pollen', 'dust', 'mold',
      'bee', 'wasp', 'ant', 'mosquito', 'cat', 'dog', 'nickel',
      'iodine', 'morphine', 'codeine'
    ];
  }

  parsePatientSearch(query) {
    const criteria = {};
    const lowerQuery = query.toLowerCase();

    const conditions = this.extractMedicalConditions(lowerQuery);
    if (conditions.length) criteria.medicalConditions = conditions;

    const medications = this.extractMedications(lowerQuery);
    if (medications.length) criteria.medications = medications;

    const allergies = this.extractAllergies(lowerQuery);
    if (allergies.length) criteria.allergies = allergies;

    const ageRange = this.extractAgeRange(query);
    if (ageRange) criteria.ageRange = ageRange;

    const location = this.extractLocation(query);
    if (location) criteria.location = location;

    const gender = this.extractGender(lowerQuery);
    if (gender) criteria.gender = gender;

    const insurance = this.extractInsurance(query);
    if (insurance) criteria.insurance = insurance;

    return criteria;
  }

  extractMedicalConditions(query) {
    const found = [];

    for (const condition of this.medicalConditions) {
      if (query.includes(condition)) {
        found.push(condition);
      }
    }

    const diabetesVariations = ['diabetic', 'diabetes', 'dm', 'type 2 diabetes', 'type 1 diabetes'];
    if (diabetesVariations.some(v => query.includes(v)) && !found.includes('diabetes')) {
      found.push('diabetes');
    }

    const hypertensionVariations = ['hypertension', 'high blood pressure', 'htn', 'hypertensive'];
    if (hypertensionVariations.some(v => query.includes(v)) && !found.includes('hypertension')) {
      found.push('hypertension');
    }

    const heartVariations = ['heart disease', 'cardiac', 'coronary', 'cad', 'chf', 'heart failure'];
    if (heartVariations.some(v => query.includes(v)) && !found.includes('heart disease')) {
      found.push('heart disease');
    }

    return found;
  }

  extractMedications(query) {
    const found = [];

    for (const med of this.commonMedications) {
      if (query.includes(med)) {
        found.push(med);
      }
    }

    const medPatterns = [
      /taking\s+(\w+)/gi,
      /on\s+(\w+)\s+medication/gi,
      /prescribed\s+(\w+)/gi
    ];

    for (const pattern of medPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const potentialMed = match[1].toLowerCase();
        if (!found.includes(potentialMed) && this.isPotentialMedication(potentialMed)) {
          found.push(potentialMed);
        }
      }
    }

    return found;
  }

  extractAllergies(query) {
    const found = [];

    for (const allergy of this.commonAllergies) {
      if (query.includes(allergy)) {
        found.push(allergy);
      }
    }

    const allergyPatterns = [
      /allergic to\s+(\w+)/gi,
      /(\w+)\s+allergy/gi,
      /allergy to\s+(\w+)/gi
    ];

    for (const pattern of allergyPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const potentialAllergy = match[1].toLowerCase();
        if (!found.includes(potentialAllergy)) {
          found.push(potentialAllergy);
        }
      }
    }

    return found;
  }

  extractAgeRange(query) {
    const agePatterns = [
      /age[d]?\s+(\d+)\s*[-to]+\s*(\d+)/i,
      /(\d+)\s*[-to]+\s*(\d+)\s*years?\s*old/i,
      /between\s+(\d+)\s+and\s+(\d+)(?:\s+years?)?/i,
      /from\s+(\d+)\s+to\s+(\d+)\s+years?/i,
      /ages?\s+(\d+)-(\d+)/i
    ];

    for (const pattern of agePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          min: parseInt(match[1]),
          max: parseInt(match[2])
        };
      }
    }

    const singleAgePatterns = [
      /over\s+(\d+)/i,
      /above\s+(\d+)/i,
      /older than\s+(\d+)/i,
      /(\d+)\+\s*years?/i
    ];

    for (const pattern of singleAgePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          min: parseInt(match[1]),
          max: 120
        };
      }
    }

    const underAgePatterns = [
      /under\s+(\d+)/i,
      /below\s+(\d+)/i,
      /younger than\s+(\d+)/i,
      /less than\s+(\d+)\s*years?/i
    ];

    for (const pattern of underAgePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          min: 0,
          max: parseInt(match[1])
        };
      }
    }

    const specificGroups = {
      'elderly': { min: 65, max: 120 },
      'senior': { min: 65, max: 120 },
      'pediatric': { min: 0, max: 18 },
      'children': { min: 0, max: 18 },
      'adult': { min: 18, max: 65 },
      'teenager': { min: 13, max: 19 },
      'infant': { min: 0, max: 2 }
    };

    for (const [term, range] of Object.entries(specificGroups)) {
      if (query.toLowerCase().includes(term)) {
        return range;
      }
    }

    return null;
  }

  extractLocation(query) {
    const location = {};

    const cityPattern = /in\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/;
    const cityMatch = query.match(cityPattern);
    if (cityMatch) {
      location.city = cityMatch[1];
    }

    const statePatterns = [
      /\b([A-Z]{2})\b/,
      /in\s+(?:state of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
    ];

    for (const pattern of statePatterns) {
      const match = query.match(pattern);
      if (match && this.isValidState(match[1])) {
        location.state = match[1];
        break;
      }
    }

    const zipPattern = /\b(\d{5})\b/;
    const zipMatch = query.match(zipPattern);
    if (zipMatch) {
      location.zipCode = zipMatch[1];
    }

    return Object.keys(location).length > 0 ? location : null;
  }

  extractGender(query) {
    if (/\bmale\b|\bmen\b|\bman\b/i.test(query) && !/\bfemale\b/i.test(query)) {
      return 'Male';
    }
    if (/\bfemale\b|\bwomen\b|\bwoman\b/i.test(query)) {
      return 'Female';
    }
    return null;
  }

  extractInsurance(query) {
    const insuranceProviders = [
      'medicare', 'medicaid', 'blue cross', 'blue shield',
      'aetna', 'cigna', 'humana', 'united', 'anthem',
      'kaiser', 'wellcare', 'molina', 'centene'
    ];

    for (const provider of insuranceProviders) {
      if (query.toLowerCase().includes(provider)) {
        return provider.charAt(0).toUpperCase() + provider.slice(1);
      }
    }

    const insurancePattern = /with\s+(\w+(?:\s+\w+)?)\s+insurance/i;
    const match = query.match(insurancePattern);
    if (match) {
      return match[1];
    }

    return null;
  }

  isPotentialMedication(word) {
    return word.length > 3 && /^[a-z]+$/.test(word) && !this.isCommonWord(word);
  }

  isCommonWord(word) {
    const commonWords = [
      'with', 'have', 'been', 'that', 'this', 'from', 'were',
      'will', 'what', 'when', 'where', 'which', 'while'
    ];
    return commonWords.includes(word);
  }

  isValidState(str) {
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    return states.includes(str.toUpperCase());
  }
}

module.exports = SearchQueryParser;