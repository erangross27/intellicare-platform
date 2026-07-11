module.exports = {
  title: '🧠 PHQ-9 Depression Screen',
  columns: ['Date', 'Score', 'Severity', 'Suicidal Ideation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Score: getValue(entry.score || entry.phq9Score),
      Severity: getValue(entry.severity || entry.depressionSeverity),
      'Suicidal Ideation': getValue(entry.suicidalIdeation || entry.si),
      Provider: getValue(entry.provider)
    }));
  }
};
