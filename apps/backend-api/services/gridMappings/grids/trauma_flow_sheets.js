module.exports = {
  title: '🚨 Trauma Flow Sheets',
  columns: ['Date/Time', 'Mechanism', 'Interventions', 'Status', 'Trauma Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Mechanism: getValue(entry.mechanism || entry.injuryMechanism),
      Interventions: getValue(entry.interventions || entry.treatment),
      Status: getValue(entry.status || entry.condition),
      'Trauma Surgeon': getValue(entry.traumaSurgeon || entry.provider)
    }));
  }
};
