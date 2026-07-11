module.exports = {
  title: '🏃 Functional Status',
  columns: ['Date', 'Performance Status', 'Activity Level', 'Limitations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Performance Status': getValue(entry.performanceStatus || entry.ecog || entry.karnofsky),
      'Activity Level': getValue(entry.activityLevel || entry.activity),
      Limitations: getValue(entry.limitations || entry.restrictions),
      Provider: getValue(entry.provider)
    }));
  }
};
