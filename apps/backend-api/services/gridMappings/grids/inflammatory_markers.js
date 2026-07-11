module.exports = {
  title: '🔥 Inflammatory Markers',
  columns: ['Date', 'CRP', 'ESR', 'Procalcitonin', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      CRP: getValue(entry.crp || entry.cReactiveProtein),
      ESR: getValue(entry.esr || entry.sedRate),
      Procalcitonin: getValue(entry.procalcitonin || entry.pct),
      Provider: getValue(entry.provider)
    }));
  }
};
