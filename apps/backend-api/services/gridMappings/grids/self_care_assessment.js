module.exports = {
  title: '🧘 Self-Care Assessment',
  columns: ['Date', 'Activity', 'Independence Level', 'Assistance Needed', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Activity: getValue(entry.activity || entry.adl),
      'Independence Level': getValue(entry.independenceLevel || entry.level),
      'Assistance Needed': getValue(entry.assistanceNeeded || entry.support),
      Provider: getValue(entry.provider)
    }));
  }
};
