module.exports = {
  title: '🩺 Urology Assessment',
  columns: ['Date', 'Condition', 'Symptoms', 'Plan', 'Urologist'],
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
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Plan: getValue(entry.plan || entry.treatment),
      Urologist: getValue(entry.urologist || entry.provider)
    }));
  }
};
