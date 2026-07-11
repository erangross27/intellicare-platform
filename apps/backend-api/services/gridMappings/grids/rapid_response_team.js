module.exports = {
  title: '🚨 Rapid Response Team',
  columns: ['Date/Time', 'Reason', 'Interventions', 'Outcome', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Reason: getValue(entry.reason || entry.triggeringEvent),
      Interventions: getValue(entry.interventions || entry.actions),
      Outcome: getValue(entry.outcome || entry.resolution),
      Provider: getValue(entry.provider)
    }));
  }
};
