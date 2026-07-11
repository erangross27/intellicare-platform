module.exports = {
  title: '🚨 Code Blue Summaries',
  columns: ['Date/Time', 'Location', 'Interventions', 'Outcome', 'Physician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Location: getValue(entry.location || entry.site),
      Interventions: getValue(entry.interventions || entry.treatment),
      Outcome: getValue(entry.outcome || entry.result),
      Physician: getValue(entry.physician || entry.provider)
    }));
  }
};
