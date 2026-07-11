module.exports = {
  title: '👶 Delivery Planning',
  columns: ['Date', 'Estimated Due Date', 'Delivery Method', 'Location', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      edd: entry.edd ? new Date(entry.edd).toLocaleDateString() : '-',
      'Delivery Method': getValue(entry.deliveryMethod || entry.plannedDelivery),
      Location: getValue(entry.location || entry.hospital),
      Provider: getValue(entry.provider || entry.obstetrician)
    }));
  }
};
