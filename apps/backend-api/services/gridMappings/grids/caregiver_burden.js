module.exports = {
  title: '👨‍👩‍👧 Caregiver Burden',
  columns: ['Date', 'Burden Level', 'Areas of Concern', 'Support Provided', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Burden Level': getValue(entry.burdenLevel || entry.level),
      'Areas of Concern': getValue(entry.areasOfConcern || entry.concerns),
      'Support Provided': getValue(entry.supportProvided || entry.interventions),
      Provider: getValue(entry.provider)
    }));
  }
};
