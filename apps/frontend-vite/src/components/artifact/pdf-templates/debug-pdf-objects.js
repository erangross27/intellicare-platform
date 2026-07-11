/**
 * PDF Object Detection Script
 *
 * This script wraps ALL data fields in the PDF template to detect which ones are objects
 * instead of strings, causing the "Objects are not valid as a React child" error.
 *
 * Usage: Add this helper function to the PDF template and use checkField() for every field.
 */

export const createPDFDebugger = () => {
  const objectFields = [];

  const checkField = (value, fieldPath) => {
    const valueType = typeof value;

    // Log ALL non-string values
    if (value !== null && value !== undefined) {
      if (valueType === 'object') {
        console.error(`🚨 OBJECT FIELD DETECTED: ${fieldPath}`, {
          type: valueType,
          isArray: Array.isArray(value),
          keys: Array.isArray(value) ? `Array[${value.length}]` : Object.keys(value).join(', '),
          value: value
        });
        objectFields.push(fieldPath);
      } else if (valueType === 'number' || valueType === 'boolean') {
        console.warn(`⚠️ NON-STRING FIELD: ${fieldPath}`, {
          type: valueType,
          value: value
        });
      }
    }

    // Convert to safe string
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(item =>
          typeof item === 'string' ? item : JSON.stringify(item)
        ).join(', ');
      }
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    return String(value);
  };

  const getReport = () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PDF OBJECT DETECTION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (objectFields.length === 0) {
      console.log('✅ No object fields detected - all fields are safe');
    } else {
      console.log(`🚨 ${objectFields.length} OBJECT FIELDS DETECTED:`);
      objectFields.forEach((field, idx) => {
        console.log(`   ${idx + 1}. ${field}`);
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  };

  return { checkField, getReport, objectFields };
};

/**
 * SYSTEMATIC FIX GENERATOR
 *
 * After identifying object fields, this generates the fix code.
 */
export const generateFix = (fieldPath) => {
  const parts = fieldPath.split('.');
  const lastPart = parts[parts.length - 1];

  return `
// FIX for ${fieldPath}:
const ${lastPart}Text = typeof ${fieldPath} === 'string'
  ? ${fieldPath}
  : (typeof ${fieldPath} === 'object'
      ? formatObject(${fieldPath})
      : String(${fieldPath}));

// Then use: {${lastPart}Text}
`.trim();
};
