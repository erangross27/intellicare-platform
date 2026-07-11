module.exports = {
  title: '🥗 Nutrition Screening',
  columns: ['Date', 'Score', 'Risk Level', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Score: getValue(entry.score || entry.screeningScore),
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      'Follow-up': getValue(entry.followUp || entry.action),
      Provider: getValue(entry.provider)
    }));
  }
};
