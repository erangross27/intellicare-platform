module.exports = {
  title: '🏥 Rehabilitation Plan',
  columns: ['Date', 'Goals', 'Therapies', 'Progress', 'Provider'],
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
      Therapies: getValue(entry.therapies || entry.interventions),
      Progress: getValue(entry.progress || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
