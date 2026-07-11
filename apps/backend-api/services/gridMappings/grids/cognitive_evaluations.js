module.exports = {
  title: '🧠 Cognitive Evaluations',
  columns: ['Date', 'Test Used', 'Score', 'Interpretation', 'Neuropsychologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Test Used': getValue(entry.testUsed || entry.assessment),
      Score: getValue(entry.score || entry.totalScore),
      Interpretation: getValue(entry.interpretation || entry.findings),
      Neuropsychologist: getValue(entry.neuropsychologist || entry.provider)
    }));
  }
};
