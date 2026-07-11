module.exports = {
  title: '⚽ Athlete Specific Data',
  columns: ['Date', 'Sport', 'Position', 'Performance Metrics', 'Sports Medicine'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Sport: getValue(entry.sport || entry.activity),
      Position: getValue(entry.position || entry.role),
      'Performance Metrics': getValue(entry.performanceMetrics || entry.stats),
      'Sports Medicine': getValue(entry.sportsMedicine || entry.provider)
    }));
  }
};
