module.exports = {
  title: '🤰 Amniocentesis Reports',
  columns: ['Date', 'Gestational Age', 'Indication', 'Results', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Indication: getValue(entry.indication || entry.reason),
      Results: getValue(entry.results || entry.findings),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
