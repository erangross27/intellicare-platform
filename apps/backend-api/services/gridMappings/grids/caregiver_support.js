module.exports = {
  title: '👨‍👩‍👧 Caregiver Support',
  columns: ['Date', 'Support Type', 'Services', 'Effectiveness', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Support Type': getValue(entry.supportType || entry.type),
      Services: getValue(entry.services || entry.interventions),
      Effectiveness: getValue(entry.effectiveness || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
