import React, { useState } from 'react';
import './SmartDataRenderer.css';

/**
 * SmartDataRenderer - Universal JSON structure renderer
 *
 * Handles ANY JSON structure dynamically without hardcoded field names.
 * Supports nested objects, arrays, and primitives with type-aware coloring.
 *
 * Use Case: Collections with unpredictable field names from AI extraction
 * (e.g., outcomes_prediction might have "prognosis" OR "predictions" OR "riskScores")
 */

function SmartDataRenderer({ data, level = 0, parentKey = '' }) {
  const [copiedField, setCopiedField] = useState(null);

  // Handle null/undefined
  if (!data || (typeof data !== 'object' && typeof data !== 'boolean' && typeof data !== 'number' && typeof data !== 'string')) {
    return null;
  }

  // Handle primitive values (string, number, boolean) at top level
  if (typeof data !== 'object') {
    return (
      <div className="smart-renderer-primitive" style={{ marginLeft: level * 20 }}>
        <span style={{ color: getTypeColor(data) }}>{String(data)}</span>
      </div>
    );
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return null;

    return (
      <div className="smart-renderer-array" style={{ marginLeft: level * 20 }}>
        {data.map((item, idx) => {
          // For arrays of primitives, render inline
          if (typeof item !== 'object') {
            return (
              <div key={idx} className="array-item-primitive">
                <span className="array-bullet">•</span>
                <span style={{ color: getTypeColor(item) }}>{String(item)}</span>
              </div>
            );
          }

          // For arrays of objects, render each recursively with index
          return (
            <div key={idx} className="array-item-object">
              <div className="array-item-header">Item {idx + 1}</div>
              <SmartDataRenderer data={item} level={level + 1} parentKey={`${parentKey}[${idx}]`} />
            </div>
          );
        })}
      </div>
    );
  }

  // Handle objects - render each key-value pair
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="smart-renderer-object" style={{ marginLeft: level * 20 }}>
      {entries.map(([key, value]) => {
        // Skip internal fields
        if (key.startsWith('_')) return null;

        const fieldId = `${parentKey}.${key}`;
        const displayLabel = formatFieldName(key);
        const valueForCopy = formatValueForCopy(key, value);

        return (
          <div key={key} className="data-field">
            <div className="field-header">
              <span className="field-label">{displayLabel}:</span>
              <button
                onClick={() => copyToClipboard(valueForCopy, fieldId)}
                className="copy-button"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedField === fieldId ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="field-value">
              {renderValue(value, level)}
            </div>
          </div>
        );
      })}
    </div>
  );

  function renderValue(value, currentLevel) {
    if (value === null || value === undefined) {
      return <span className="null-value">—</span>;
    }

    // Arrays
    if (Array.isArray(value)) {
      return <SmartDataRenderer data={value} level={currentLevel + 1} parentKey={parentKey} />;
    }

    // Nested objects
    if (typeof value === 'object') {
      return <SmartDataRenderer data={value} level={currentLevel + 1} parentKey={parentKey} />;
    }

    // Primitives with type-aware coloring
    return <span style={{ color: getTypeColor(value) }}>{String(value)}</span>;
  }

  async function copyToClipboard(text, fieldId) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }
}

/**
 * Format field names for display
 * "readmissionRisk" → "Readmission Risk"
 * "patient_name" → "Patient Name"
 * "idh1Status" → "IDH1 Status"
 */
function formatFieldName(key) {
  if (!key) return '';

  return key
    // Insert space before capital letters (camelCase)
    .replace(/([A-Z])/g, ' $1')
    // Replace underscores with spaces (snake_case)
    .replace(/_/g, ' ')
    // Trim whitespace
    .trim()
    // Capitalize each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get type-aware colors
 * Boolean: Green (#10b981)
 * Number: Blue (#3b82f6)
 * Date: Orange (#ea580c)
 * String: White (#ececf1)
 */
function getTypeColor(value) {
  if (typeof value === 'boolean') return '#10b981'; // Green
  if (typeof value === 'number') return '#3b82f6';  // Blue

  // Check if string looks like a date
  if (typeof value === 'string') {
    // ISO date pattern or common date formats
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\w{3}\s+\d{1,2},\s+\d{4}/;
    if (datePattern.test(value)) {
      return '#ea580c'; // Orange
    }
  }

  return '#ececf1'; // White (default for strings)
}

/**
 * Format value for clipboard copy
 * Handles arrays, objects, and primitives
 */
function formatValueForCopy(key, value) {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    // For array of primitives, join with commas
    if (value.every(item => typeof item !== 'object')) {
      return value.join(', ');
    }
    // For array of objects, format as multi-line
    return value.map((item, idx) => {
      if (typeof item === 'object') {
        return `Item ${idx + 1}:\n${formatObjectForCopy(item, 1)}`;
      }
      return `  • ${item}`;
    }).join('\n');
  }

  if (typeof value === 'object') {
    return formatObjectForCopy(value, 0);
  }

  return String(value);
}

function formatObjectForCopy(obj, indent = 0) {
  const indentStr = '  '.repeat(indent);
  return Object.entries(obj)
    .map(([k, v]) => {
      const label = formatFieldName(k);
      if (typeof v === 'object' && !Array.isArray(v)) {
        return `${indentStr}${label}:\n${formatObjectForCopy(v, indent + 1)}`;
      }
      if (Array.isArray(v)) {
        return `${indentStr}${label}: ${v.join(', ')}`;
      }
      return `${indentStr}${label}: ${v}`;
    })
    .join('\n');
}

export default SmartDataRenderer;
