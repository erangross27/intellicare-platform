module.exports = {
  title: '👁️ Past Ocular History',
  columns: ['Date', 'Condition', 'Treatment', 'Outcome', 'Ophthalmologist'],
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
      Treatment: getValue(entry.treatment || entry.intervention),
      Outcome: getValue(entry.outcome || entry.result),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
