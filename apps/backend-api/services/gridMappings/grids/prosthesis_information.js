module.exports = {
  title: '🦿 Prosthesis Information',
  columns: ['Date', 'Prosthesis Type', 'Manufacturer', 'Size', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Prosthesis Type': getValue(entry.prosthesisType || entry.type),
      Manufacturer: getValue(entry.manufacturer || entry.brand),
      Size: getValue(entry.size || entry.dimensions),
      Provider: getValue(entry.provider)
    }));
  }
};
