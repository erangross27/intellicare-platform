module.exports = {
  title: '👴 Geriatric Assessment',
  columns: ['Date', 'Domain', 'Score', 'Concerns', 'Interventions'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Domain: getValue(entry.domain || entry.category),
      Score: getValue(entry.score || entry.result),
      Concerns: getValue(entry.concerns || entry.findings),
      Interventions: getValue(entry.interventions || entry.plan)
    }));
  }
};
