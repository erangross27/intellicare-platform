module.exports = {
  title: '🧠 Neurology Progress Notes',
  columns: ['Date', 'Condition', 'Assessment', 'Plan', 'Neurologist'],
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
      Assessment: getValue(entry.assessment || entry.findings),
      Plan: getValue(entry.plan || entry.treatment),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
