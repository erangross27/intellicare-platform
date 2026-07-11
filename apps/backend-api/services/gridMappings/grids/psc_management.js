module.exports = {
  title: '🏥 PSC Management',
  columns: ['Date', 'Assessment', 'Interventions', 'Outcome', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Assessment: getValue(entry.assessment || entry.evaluation),
      Interventions: getValue(entry.interventions || entry.actions),
      Outcome: getValue(entry.outcome || entry.result),
      Provider: getValue(entry.provider)
    }));
  }
};
