# Collection-Specific Formatters

This directory contains dedicated formatter files for each of IntelliCare's 850+ medical collections.

## Purpose

Each formatter converts raw MongoDB documents into human-readable text that:
- Matches what doctors see in the artifact panel
- Includes ALL relevant fields (no data loss)
- Uses medical terminology appropriate for physician-to-physician communication
- Is sent to Claude AI for analysis and discussion

## Structure

```
collectionFormatters/
├── index.js                      # Auto-loads all formatters
├── follow_up_intelligence.js     # Formatter for follow_up_intelligence collection
├── anesthesia_records.js         # Formatter for anesthesia_records collection
├── medications.js                # Formatter for medications collection
├── lab_results.js                # Formatter for lab_results collection
└── ... (add 846 more files, one per collection)
```

## How to Add a New Formatter

1. **Create a new file** named `{collection_name}.js`
2. **Export a function** that takes a document and returns formatted text:

```javascript
/**
 * Collection Name Formatter
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatYourCollection(doc) {
  const lines = [];

  // Format ALL important fields
  if (doc.fieldName) lines.push(`Label: ${doc.fieldName}`);

  // Handle arrays
  if (doc.arrayField && doc.arrayField.length > 0) {
    lines.push(`\nArray Field:`);
    doc.arrayField.forEach(item => {
      lines.push(`  • ${item.property}`);
    });
  }

  // Handle nested objects
  if (doc.nestedObject) {
    lines.push(`\nNested Object:`);
    if (doc.nestedObject.property) lines.push(`  Property: ${doc.nestedObject.property}`);
  }

  return lines.join('\n');
};
```

3. **Restart the backend** - The formatter will be auto-loaded by `index.js`

## Formatter Priority

The system checks formatters in this order:

1. **Collection-specific formatter** in this folder (highest priority)
2. **Legacy inline formatter** in `artifactDataFormatter.js`
3. **Generic formatter** (fallback for collections without specific formatters)

## Critical Rules

### ✅ DO:
- Include **ALL relevant fields** from the document
- Format dates consistently using the `formatDate()` helper
- Use clear, descriptive labels (e.g., "Priority:" not "p:")
- Handle missing/null fields gracefully
- Format arrays and nested objects clearly

### ❌ DON'T:
- Skip fields because they "seem unimportant" - Claude needs ALL data
- Summarize or truncate data - show the complete information
- Use internal field names (e.g., `_id`, `patientId`) - exclude these
- Include raw JSON - format it human-readable

## Example Output

**Good Formatting:**
```
📅 Upcoming Deadlines (9):

1. Basic metabolic panel (potassium, creatinine)
   Priority: Critical
   Due: September 14, 2025
   Consequences: Risk of hyperkalemia with dual RAAS blockade
   Auto-schedule: true

2. Cardiology follow-up with Dr. Martinez
   Priority: Critical
   Due: September 14, 2025
   ...
```

**Bad Formatting:**
```
deadlines: [{"item":"BMP","dueDate":"2025-09-14","criticality":"Critical"}]
```

## Migration Plan

Currently migrated: 5/850 collections
- ✅ follow_up_intelligence
- ✅ anesthesia_records
- ✅ medications
- ✅ lab_results
- ⏳ 846 remaining

**Priority for migration:**
1. AI-generated collections (clinical_decision_support, intelligent_recommendations, etc.)
2. High-use collections (diagnoses, procedures, allergies, etc.)
3. Specialty-specific collections (radiology, pathology, etc.)

## Testing

After adding a formatter, test it by:
1. Navigate to a patient with data in that collection
2. Open the artifact panel to that category
3. Ask Claude a question about the data
4. Check logs for: `📋 Loaded X collection-specific formatters`
5. Verify Claude sees ALL fields in its response
