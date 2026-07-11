/**
 * UtilityHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.477Z
 */

class UtilityHelpers {

    normalizePracticeContext(practiceContext) {
      // If PracticeContextNormalizer is available, use it
      try {
        const PracticeContextNormalizer = require('./practiceContextNormalizer');
        return PracticeContextNormalizer.normalize(practiceContext);
      } catch (err) {
        // Fallback normalization if module not available
        const practiceId =
          practiceContext?.practiceSubdomain ||
          practiceContext?.subdomain ||
          practiceContext?.practiceId ||
          practiceContext?.practice?.subdomain ||
          'global';
  
        return {
          ...practiceContext,
          practiceId: practiceId,
          practiceSubdomain: practiceId,
          subdomain: practiceId,
          language: practiceContext?.language || 'en'
        };
      }
    }

    createSecureContext(practiceContext, operation = 'query') {
      const practiceSubdomain = practiceContext?.practiceSubdomain ||
                                practiceContext?.subdomain ||
                                practiceContext?.practiceId;
  
      return {
        serviceId: this.serviceName,
        operation: operation,
        practiceId: practiceSubdomain,
        practiceSubdomain: practiceSubdomain,
        userId: practiceContext?.user?.id || practiceContext?.user?._id,
        apiKey: this.serviceAuth?.apiKey || this.serviceAuth // Include API key for authentication
      };
    }

    estimateTokens(text) {
      if (!text) return 0;
      // More conservative estimate based on Claude tokenization patterns:
      // - English: ~3.5 chars per token
      // - Hebrew/other languages: ~2.5 chars per token
      // - JSON/structured data: ~4 chars per token
      const hasNonEnglish = /[\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/.test(text);
      const isStructuredData = text.includes('{') || text.includes('[');
      
      let charsPerToken;
      if (isStructuredData) {
        charsPerToken = 4; // JSON, function definitions
      } else if (hasNonEnglish) {
        charsPerToken = 2.5; // Hebrew, Arabic, Chinese etc.
      } else {
        charsPerToken = 3.5; // English text
      }
      
      return Math.ceil(text.length / charsPerToken);
    }

    calculateCost(inputTokens, outputTokens) {
      const inputCost = (inputTokens / 1000000) * this.pricing.inputPer1M;
      const outputCost = (outputTokens / 1000000) * this.pricing.outputPer1M;
      const totalCostUSD = inputCost + outputCost;
      
      // Convert to ILS (Israeli New Shekel)
      const USD_TO_ILS = 3.38; // Current exchange rate
      const totalCostILS = totalCostUSD * USD_TO_ILS;
      
      return {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        inputCost: inputCost.toFixed(6),
        outputCost: outputCost.toFixed(6),
        totalCost: totalCostUSD.toFixed(6),
        totalCostCents: (totalCostUSD * 100).toFixed(4),
        totalCostILS: totalCostILS.toFixed(4),
        totalCostAgorot: (totalCostILS * 100).toFixed(2) // Agorot = Israeli cents
      };
    }

    cleanUndefinedProperties(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            cleaned[key] = this.cleanUndefinedProperties(value);
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    }

    detectLanguage(message, fallback) {
      if (/[\u0590-\u05FF]/.test(message)) return 'he';
      if (/^[A-Za-z0-9\s\.\,\!\?\-\(\)]+$/.test(message)) return 'en';
      return fallback === 'auto' ? 'he' : fallback;
    }

    detectClinicCountry(practiceContext) {
      if (practiceContext?.address?.country) return practiceContext.address.country;
      if (practiceContext?.settings?.country) return practiceContext.settings.country;
      if (practiceContext?.subdomain?.includes('us')) return 'USA';
      return 'Israel';
    }

    formatDate(dateStr, language) {
      if (!dateStr) return dateStr;
      
      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // Try to parse the date intelligently
      let date;
      
      // Handle various formats
      if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}$/.test(dateStr)) {
        // DD/MM/YYYY or MM/DD/YYYY format
        const parts = dateStr.split(/[\/\.\-]/);
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Intelligent detection: if first number > 12, it's definitely day
        if (day > 12) {
          // DD/MM/YYYY format
          date = new Date(year, month - 1, day);
        } else if (month > 12) {
          // MM/DD/YYYY format (month and day swapped)
          date = new Date(year, day - 1, month);
        } else {
          // Ambiguous - use language preference
          if (language === 'he' || language === 'IL') {
            // Israeli format: DD/MM/YYYY
            date = new Date(year, month - 1, day);
          } else {
            // US format: MM/DD/YYYY
            date = new Date(year, day - 1, month);
          }
        }
      } else if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2}$/.test(dateStr)) {
        // Short year format (DD/MM/YY or MM/DD/YY)
        const parts = dateStr.split(/[\/\.\-]/);
        const year = 2000 + parseInt(parts[2]); // Assume 20xx
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        
        if (language === 'he' || language === 'IL') {
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(year, day - 1, month);
        }
      } else {
        // Try native Date parsing (handles "August 15, 1990", etc.)
        date = new Date(dateStr);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If parsing failed, return original string
        return dateStr;
      }
      
      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    }

    formatFunctionResult(functionName, result, language) {
      if (!result.success) {
        return language === 'he' ? 'אירעה שגיאה בביצוע הפעולה' : 'An error occurred performing the action';
      }
  
      // Check if this result has gridFormat - if so, return a simple message
      // The actual grid data will be displayed by the frontend
      if (result.data && result.data.gridFormat) {
        const displayTitle = result.data.displayTitle || functionName;
        const totalRecords = result.data.data ? result.data.data.length : 0;
  
        if (language === 'he') {
          return `מציג ${totalRecords} תוצאות עבור: ${displayTitle}`;
        } else {
          return `Displaying ${totalRecords} results for: ${displayTitle}`;
        }
      }
  
      switch(functionName) {
        case 'getPatientDetails':
          // Return FULL patient details, not just confirmation
          if (result.data) {
            const p = result.data;
  
            // Build comprehensive patient details
            let details = [];
  
            // Basic Information
            details.push(`**${p.firstName || ''} ${p.lastName || ''}**`);
            if (p._id) details.push(`ID: ${p._id}`);
  
            // Personal Details
            if (p.dateOfBirth) details.push(`DOB: ${new Date(p.dateOfBirth).toLocaleDateString()}`);
            if (p.gender) details.push(`Gender: ${p.gender}`);
            if (p.socialSecurityNumber || p.ssn) details.push(`SSN: ${p.socialSecurityNumber || p.ssn}`);
  
            // Contact Information
            if (p.phone) details.push(`Phone: ${p.phone}`);
            if (p.email) details.push(`Email: ${p.email}`);
            if (p.preferredLanguage) details.push(`Language: ${p.preferredLanguage}`);
  
            // Address
            if (p.street || p.city || p.state) {
              details.push(`Address: ${p.street || ''} ${p.city || ''}, ${p.state || ''} ${p.zipCode || ''} ${p.country || ''}`);
            }
  
            // Medical Information
            if (p.bloodType) details.push(`Blood Type: ${p.bloodType}`);
            if (p.allergies) {
              const allergies = Array.isArray(p.allergies) ? p.allergies.join(', ') : p.allergies;
              details.push(`Allergies: ${allergies}`);
            }
            if (p.diagnosis && p.diagnosis.length > 0) {
              details.push(`Diagnoses: ${p.diagnosis.join(', ')}`);
            }
            if (p.medications && p.medications.length > 0) {
              details.push(`Medications: ${p.medications.join(', ')}`);
            }
  
            // Provider Information
            if (p.primaryPhysician) details.push(`Primary Physician: ${p.primaryPhysician}`);
            if (p.doctorSummary) details.push(`Summary: ${p.doctorSummary}`);
  
            // Insurance
            if (p.insuranceProvider) details.push(`Insurance: ${p.insuranceProvider}`);
            if (p.insuranceNumber) details.push(`Policy #: ${p.insuranceNumber}`);
  
            // Emergency Contact
            if (p.emergencyContact) {
              details.push(`Emergency Contact: ${p.emergencyContact}`);
              if (p.emergencyContactPhone) details.push(`Emergency Phone: ${p.emergencyContactPhone}`);
            }
  
            // Status
            if (p.status) details.push(`Status: ${p.status}`);
  
            // Notes
            if (p.notes) details.push(`Notes: ${p.notes}`);
  
            return details.join('\n');
          }
          break;
          
        case 'searchPatients':
          if (result.data && result.data.length > 0) {
            // Minimal confirmation - data shown in split screen
            return language === 'he' 
              ? `✓ הפעולה הושלמה בהצלחה`
              : `✓ Operation completed successfully`;
          } else if (result.data && result.data.length === 0) {
            return language === 'he' 
              ? 'לא נמצאו מטופלים התואמים לחיפוש'
              : 'No patients found matching the search';
          }
          return result.message || (language === 'he' ? 'החיפוש הושלם' : 'Search completed');
          
        case 'updatePatient':
          // Minimal confirmation
          return language === 'he' ? '✓ הפעולה הושלמה בהצלחה' : '✓ Operation completed successfully';
          
        case 'addPatient':
          // Minimal confirmation for new patient
          return language === 'he' ? '✓ המטופל נוסף בהצלחה' : '✓ Patient added successfully';
          
        case 'getDocuments':
          // Minimal confirmation - documents shown in split screen
          if (result.data && Array.isArray(result.data) && result.data.length > 0) {
            return language === 'he' 
              ? `✓ נמצאו ${result.data.length} מסמכים`
              : `✓ Found ${result.data.length} documents`;
          } else if (result.data && Array.isArray(result.data) && result.data.length === 0) {
            return language === 'he' 
              ? 'לא נמצאו מסמכים למטופל זה'
              : 'No documents found for this patient';
          }
          return result.message || (language === 'he' ? 'החיפוש הושלם' : 'Search completed');
  
        case 'getAppointments':
          if (result.data && Array.isArray(result.data)) {
            if (result.data.length === 0) {
              return language === 'he'
                ? 'לא נמצאו פגישות מתוזמנות למטופל זה'
                : 'No scheduled appointments found for this patient';
            } else {
              const appointments = result.data.map(apt => {
                const date = apt.date ? new Date(apt.date).toLocaleDateString() : 'TBD';
                const time = apt.time || 'TBD';
                const doctor = apt.doctor || apt.provider || 'TBD';
                const reason = apt.reason || apt.type || 'General';
                return `• ${date} at ${time} with ${doctor} - ${reason}`;
              }).join('\n');
  
              return language === 'he'
                ? `נמצאו ${result.data.length} פגישות:\n${appointments}`
                : `Found ${result.data.length} appointment(s):\n${appointments}`;
            }
          }
          // If result.data is not an array, just return it as is
          return result.data || (language === 'he' ? 'לא נמצאו פגישות' : 'No appointments found');
  
        default:
          return language === 'he' ? '✓ הפעולה הושלמה בהצלחה' : '✓ Operation completed successfully';
      }
    }

    convertFieldName(name, toSnakeCase = true) {
      if (toSnakeCase) {
        // Convert camelCase to snake_case
        return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
      } else {
        // Convert snake_case to camelCase
        return name.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      }
    }

    getFieldData(extractedData, camelCaseName) {
      const snakeCaseName = this.convertFieldName(camelCaseName, true);
      return extractedData[camelCaseName] || extractedData[snakeCaseName] || null;
    }

    parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      // Remove surrounding quotes from values
      return values.map(value => {
        if (value.startsWith('"') && value.endsWith('"')) {
          return value.slice(1, -1);
        }
        return value;
      });
    }

    suggestUserFieldMappings(headers) {
      const mappings = {};
      const commonMappings = {
        'email': ['email', 'e-mail', 'mail', 'email_address'],
        'firstName': ['firstname', 'first_name', 'fname', 'given_name', 'profile.firstName'],
        'lastName': ['lastname', 'last_name', 'lname', 'surname', 'family_name', 'profile.lastName'],
        'phone': ['phone', 'telephone', 'mobile', 'cell', 'phone_number', 'profile.phone'],
        'role': ['role', 'roles', 'position', 'job_title'],
        'department': ['department', 'dept', 'division', 'unit', 'providerInfo.departments'],
        'specialties': ['specialty', 'specialties', 'specialization', 'providerInfo.specialties'],
        'licenseNumber': ['license', 'license_number', 'registration', 'providerInfo.licenseNumber'],
        'title': ['title', 'dr', 'prefix', 'profile.title']
      };
      
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        for (const [field, variations] of Object.entries(commonMappings)) {
          if (variations.some(v => lowerHeader.includes(v))) {
            mappings[field] = header;
            break;
          }
        }
      });
      
      return mappings;
    }

    calculateAge(dateOfBirth) {
      if (!dateOfBirth) return null;
      const birth = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    }

    formatFileSize(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = UtilityHelpers;
