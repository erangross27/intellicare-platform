module.exports = {
  title: '🩺 Physical Examinations',
  columns: ['Date', 'System', 'Findings', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Helper to flatten nested object into "key: value" pairs
    const flattenFindings = (obj) => {
      const findings = [];
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'string') {
          findings.push(value);
        } else if (value && typeof value === 'object') {
          // Handle nested objects recursively
          const nested = flattenFindings(value);
          if (nested.length > 0) {
            findings.push(...nested);
          }
        }
      }
      return findings;
    };

    const rows = [];

    // Fields to skip (metadata, not body systems)
    const skipFields = ['_id', 'patientId', 'documentId', 'date', 'examinationDate', 'provider', 'examiner', 'source', '_securityMetadata', 'findings', 'notes', 'system', 'bodySystem'];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() :
                   (entry.examinationDate ? new Date(entry.examinationDate).toLocaleDateString() : '-');
      const provider = getValue(entry.provider || entry.examiner, 'Examining Physician');

      // Process each field as a potential body system
      for (const [fieldName, fieldValue] of Object.entries(entry)) {
        // Skip metadata fields
        if (skipFields.includes(fieldName)) continue;

        // Handle string fields (like "general")
        if (typeof fieldValue === 'string') {
          rows.push({
            'Date': date,
            'Findings': getValue(fieldValue),
            'System': fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
            'Provider': provider
          });
        }
        // Handle object fields (like cardiovascular, respiratory, etc.)
        else if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
          const findings = flattenFindings(fieldValue);
          // Create a separate row for each finding
          findings.forEach(finding => {
            rows.push({
              'Date': date,
              'System': fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
              'Findings': getValue(finding),
              'Provider': provider
            });
          });
        }
      }

      // Fallback for old simple structure
      if (rows.length === 0 && (entry.findings || entry.notes)) {
        rows.push({
          'Date': date,
          'Findings': getValue(entry.findings || entry.notes),
          'System': getValue(entry.system || entry.bodySystem, 'General'),
          'Provider': provider
        });
      }
    });

    return rows;
  }
};
