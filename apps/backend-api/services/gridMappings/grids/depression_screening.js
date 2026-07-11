module.exports = {
  title: '🧠 Depression Screening',
  columns: ['Date', 'Screening Tool', 'Score', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Screening Tool': getValue(entry.screeningTool || entry.tool),
      Score: getValue(entry.score || entry.totalScore),
      Interpretation: getValue(entry.interpretation || entry.result),
      Provider: getValue(entry.provider)
    }));
  }
};
