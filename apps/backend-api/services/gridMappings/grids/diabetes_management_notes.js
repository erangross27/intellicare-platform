module.exports = {
  title: '🩺 Endocrinology / Diabetes',
  columns: ['Date', 'A1C', 'Blood Glucose', 'Management Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      A1C: getValue(entry.a1c || entry.hba1c),
      'Blood Glucose': getValue(entry.bloodGlucose || entry.glucose),
      'Management Plan': getValue(entry.plan || entry.management || entry.recommendations),
      Provider: getValue(entry.provider || entry.endocrinologist)
    }));
  }
};
