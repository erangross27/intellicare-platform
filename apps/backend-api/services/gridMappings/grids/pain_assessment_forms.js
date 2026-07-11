module.exports = {
  title: '😖 Pain Assessment Forms',
  columns: ['Date/Time', 'Pain Level', 'Location', 'Interventions', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Location: getValue(entry.location || entry.site),
      Interventions: getValue(entry.interventions || entry.treatment),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
