module.exports = {
  title: '🤝 Social Support',
  columns: ['Date', 'Support Type', 'Availability', 'Adequacy', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Support Type': getValue(entry.supportType || entry.type),
      Availability: getValue(entry.availability || entry.access),
      Adequacy: getValue(entry.adequacy || entry.sufficiency),
      Provider: getValue(entry.provider)
    }));
  }
};
