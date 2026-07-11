module.exports = {
  title: '💊 Treatment Summary',
  columns: ['Date', 'Diagnosis', 'Treatments', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.condition),
      Treatments: getValue(entry.treatments || entry.therapies),
      Response: getValue(entry.response || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
