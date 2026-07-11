module.exports = {
  title: '🪞 Body Image Concerns',
  columns: ['Date', 'Concern', 'Impact', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Concern: getValue(entry.concern || entry.issue),
      Impact: getValue(entry.impact || entry.severity),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider || entry.counselor)
    }));
  }
};
