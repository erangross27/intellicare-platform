module.exports = {
  title: '🧠 Neuropsych Testing',
  columns: ['Date', 'Test Battery', 'Scores', 'Interpretation', 'Psychologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Battery': getValue(entry.testBattery || entry.tests),
      Scores: getValue(entry.scores || entry.results),
      Interpretation: getValue(entry.interpretation || entry.findings),
      Psychologist: getValue(entry.psychologist || entry.provider)
    }));
  }
};
