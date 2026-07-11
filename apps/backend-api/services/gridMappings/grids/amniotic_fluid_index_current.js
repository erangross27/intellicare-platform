module.exports = {
  title: '🤰 Amniotic Fluid Index',
  columns: ['Date', 'AFI Value', 'Quadrants', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'AFI Value': getValue(entry.afiValue || entry.afi || entry.value),
      Quadrants: getValue(entry.quadrants),
      Status: getValue(entry.status || entry.interpretation),
      Provider: getValue(entry.provider)
    }));
  }
};
