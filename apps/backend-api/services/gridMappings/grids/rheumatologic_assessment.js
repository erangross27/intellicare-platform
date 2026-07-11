module.exports = {
  title: '🦴 Rheumatologic Assessment',
  columns: ['Date', 'Condition', 'Disease Activity', 'Labs', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Condition: getValue(entry.condition || entry.diagnosis),
      'Disease Activity': getValue(entry.diseaseActivity || entry.activity),
      Labs: getValue(entry.labs || entry.labResults),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
