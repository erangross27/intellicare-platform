module.exports = {
  title: '🩸 Blood Products',
  columns: ['Date', 'Product Type', 'Units', 'Indication', 'Reaction'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Product Type': getValue(entry.productType || entry.product || entry.type),
      Units: getValue(entry.units || entry.quantity),
      Indication: getValue(entry.indication || entry.reason),
      Reaction: getValue(entry.reaction || entry.adverseEvent, 'None')
    }));
  }
};
