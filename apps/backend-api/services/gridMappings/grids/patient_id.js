module.exports = {
  title: '🆔 Patient ID Records',
  columns: ['Date', 'ID Type', 'ID Number', 'Facility', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'ID Type': getValue(entry.idType || entry.type),
      'ID Number': getValue(entry.idNumber || entry.value),
      Facility: getValue(entry.facility || entry.institution),
      Provider: getValue(entry.provider)
    }));
  }
};
