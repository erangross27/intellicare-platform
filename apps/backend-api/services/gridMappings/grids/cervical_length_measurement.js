module.exports = {
  title: '🤰 Cervical Length',
  columns: ['Date', 'Gestational Age', 'Cervical Length', 'Risk', 'Plan'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.weeks),
      'Cervical Length': getValue(entry.cervicalLength || entry.length),
      Risk: getValue(entry.risk || entry.assessment),
      Plan: getValue(entry.plan || entry.management)
    }));
  }
};
