module.exports = {
  title: '🧬 Autoimmune Evaluations',
  columns: ['Date', 'Condition', 'Antibodies', 'Activity', 'Rheumatologist'],
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
      Antibodies: getValue(entry.antibodies || entry.serology),
      Activity: getValue(entry.activity || entry.diseaseActivity),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
