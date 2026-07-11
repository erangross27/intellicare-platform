module.exports = {
  title: '🩸 Blood Products Ordered',
  columns: ['Date', 'Product Type', 'Units', 'Indication', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Product Type': getValue(entry.productType || entry.product),
      Units: getValue(entry.units || entry.quantity),
      Indication: getValue(entry.indication || entry.reason),
      Provider: getValue(entry.provider)
    }));
  }
};
