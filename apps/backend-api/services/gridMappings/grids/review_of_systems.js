module.exports = {
  title: '🔍 Review of Systems',
  columns: ['Date', 'System', 'Findings', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // System field names that appear in the extracted data
    const systemFields = [
      'constitutional', 'cardiovascular', 'respiratory', 'gastrointestinal',
      'genitourinary', 'musculoskeletal', 'neurological', 'psychiatric',
      'endocrine', 'hematologic', 'allergic', 'skin'
    ];

    // Flatten system-specific fields into individual rows
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const provider = getValue(entry.provider);

      let foundSystemFields = false;
      systemFields.forEach(systemField => {
        const findings = getValue(entry[systemField]);
        // Only add row if there are actual findings (not just dashes)
        if (findings !== '-') {
          rows.push({
            Date: date,
            System: systemField.charAt(0).toUpperCase() + systemField.slice(1),
            Findings: findings,
            Provider: provider
          });
          foundSystemFields = true;
        }
      });

      // Fallback for non-standard format - ONLY if no systemFields were found
      if (!foundSystemFields && entry.system && entry.findings) {
        rows.push({
          Date: date,
          System: getValue(entry.system || entry.category),
          Findings: getValue(entry.findings || entry.symptoms || entry.review),
          Provider: provider
        });
      }
    });

    return rows;
  }
};
