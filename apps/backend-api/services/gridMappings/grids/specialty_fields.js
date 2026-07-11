module.exports = {
  title: '🔍 Specialty Fields',
  columns: ['Date', 'Specialty', 'Field Name', 'Value', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.specialty || entry.department),
      'Field Name': getValue(entry.fieldName || entry.field),
      Value: getValue(entry.value || entry.data),
      Provider: getValue(entry.provider)
    }));
  }
};
