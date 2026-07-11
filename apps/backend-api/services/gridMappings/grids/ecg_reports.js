module.exports = {
  title: '📈 ECG Reports',
  columns: ['Date', 'Rate', 'Rhythm', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Rate: getValue(entry.rate || entry.heartRate),
      Rhythm: getValue(entry.rhythm || entry.cardiacRhythm),
      Interpretation: getValue(entry.interpretation || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
