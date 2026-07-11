module.exports = {
  title: '💧 IV Fluid Orders',
  columns: ['Date/Time', 'Fluid Type', 'Rate', 'Volume', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Fluid Type': getValue(entry.fluidType || entry.fluid),
      Rate: getValue(entry.rate || entry.infusionRate),
      Volume: getValue(entry.volume || entry.totalVolume),
      Provider: getValue(entry.provider)
    }));
  }
};
