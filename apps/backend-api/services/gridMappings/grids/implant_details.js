module.exports = {
  title: '🦴 Implant Details',
  columns: ['Date', 'Implant Type', 'Size/Model', 'Location', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Implant Type': getValue(entry.implantType || entry.device),
      'Size/Model': getValue(entry.sizeModel || entry.specifications),
      Location: getValue(entry.location || entry.site),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
