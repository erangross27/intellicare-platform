module.exports = {
  title: '📋 Treatment Plan',
  columns: ['Date', 'Interventions', 'Goals', 'Timeline', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Interventions: getValue(entry.interventions || entry.treatments),
      Goals: getValue(entry.goals || entry.objectives),
      Timeline: getValue(entry.timeline || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
