module.exports = {
  title: '📋 Psychiatric Treatment Plan',
  columns: ['Date', 'Goals', 'Interventions', 'Frequency', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Goals: getValue(entry.goals || entry.objectives),
      Interventions: getValue(entry.interventions || entry.treatments),
      Frequency: getValue(entry.frequency || entry.schedule),
      Provider: getValue(entry.provider)
    }));
  }
};
