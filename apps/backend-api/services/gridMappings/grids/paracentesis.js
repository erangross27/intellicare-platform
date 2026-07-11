module.exports = {
  title: '💉 Paracentesis',
  columns: ['Date', 'Volume Removed', 'Fluid Analysis', 'Complications', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Volume Removed': getValue(entry.volumeRemoved || entry.volume),
      'Fluid Analysis': getValue(entry.fluidAnalysis || entry.results),
      Complications: getValue(entry.complications || entry.issues),
      Provider: getValue(entry.provider)
    }));
  }
};
