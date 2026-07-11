module.exports = {
  title: '🧼 Prep and Drape',
  columns: ['Date', 'Prep Solution', 'Area Prepped', 'Draping', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Prep Solution': getValue(entry.prepSolution || entry.solution),
      'Area Prepped': getValue(entry.areaPrepped || entry.area),
      Draping: getValue(entry.draping || entry.drapingTechnique),
      Provider: getValue(entry.provider)
    }));
  }
};
