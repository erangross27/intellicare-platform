module.exports = {
  title: '⚠️ Allergy Assessment',
  columns: ['Date', 'Allergen', 'Reaction', 'Severity', 'Testing Performed'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Allergen: getValue(entry.allergen || entry.substance),
      Reaction: getValue(entry.reaction || entry.symptoms),
      Severity: getValue(entry.severity),
      'Testing Performed': getValue(entry.testing || entry.testingPerformed)
    }));
  }
};
