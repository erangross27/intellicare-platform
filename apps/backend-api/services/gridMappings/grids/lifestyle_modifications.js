module.exports = {
  title: '🏃 Lifestyle Modifications',
  columns: ['Date', 'Recommendation', 'Goal', 'Progress', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Recommendation: getValue(entry.recommendation || entry.modification),
      Goal: getValue(entry.goal || entry.targetGoal),
      Progress: getValue(entry.progress || entry.adherence),
      Provider: getValue(entry.provider)
    }));
  }
};
