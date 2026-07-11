module.exports = {
  title: '🚑 ED Disposition',
  columns: ['Date', 'Decision', 'Destination', 'Condition', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Decision: getValue(entry.decision || entry.disposition),
      Destination: getValue(entry.destination || entry.admittedTo),
      Condition: getValue(entry.condition || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
