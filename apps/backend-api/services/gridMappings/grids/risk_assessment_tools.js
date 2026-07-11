module.exports = {
  title: '⚠️ Risk Assessment Tools',
  columns: ['Date', 'Tool', 'Score', 'Risk Level', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Tool: getValue(entry.tool || entry.assessmentTool),
      Score: getValue(entry.score || entry.result),
      'Risk Level': getValue(entry.riskLevel || entry.risk),
      Provider: getValue(entry.provider)
    }));
  }
};
