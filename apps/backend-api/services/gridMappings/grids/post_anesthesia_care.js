module.exports = {
  title: '🏥 Post-Anesthesia Care (PACU)',
  columns: ['Date/Time', 'Aldrete Score', 'Pain Level', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Aldrete Score': getValue(entry.aldreteScore || entry.score),
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Interventions: getValue(entry.interventions || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
