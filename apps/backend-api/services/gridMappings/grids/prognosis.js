module.exports = {
  title: '📊 Prognosis',
  columns: ['Date', 'Timeline', 'Prognosis', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      // Add line breaks after periods followed by space and capital letter
      const text = String(val).trim() || defaultVal;
      if (text === defaultVal) return defaultVal;
      return text.replace(/\.\s+([A-Z])/g, '.\n$1');
    };

    // Flatten short-term and long-term prognosis into separate rows
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const provider = getValue(entry.provider);

      // Add short-term prognosis row if present
      if (entry.shortTerm) {
        rows.push({
          date, 'Timeline': 'Short-term', 'Prognosis': getValue(entry.shortTerm),
          provider
        });
      }

      // Add long-term prognosis row if present
      if (entry.longTerm) {
        rows.push({
          date, 'Timeline': 'Long-term', 'Prognosis': getValue(entry.longTerm),
          provider
        });
      }

      // Handle string format (old data with summary field)
      if (entry.summary) {
        rows.push({
          date, 'Timeline': 'Overall', 'Prognosis': getValue(entry.summary),
          provider
        });
      }

      // Fallback for non-standard format
      if (!entry.shortTerm && !entry.longTerm && !entry.summary && (entry.prognosis || entry.outlook)) {
        rows.push({
          date, 'Timeline': getValue(entry.timeline || entry.expectedCourse), 'Prognosis': getValue(entry.prognosis || entry.outlook),
          provider
        });
      }
    });

    return rows;
  }
};
