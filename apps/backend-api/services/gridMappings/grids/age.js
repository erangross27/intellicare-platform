module.exports = {
  title: '📅 Age Records',
  columns: ['Date', 'Age', 'Date of Birth', 'Recorded By', 'Source'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.value),
      'Date of Birth': getValue(entry.dateOfBirth || entry.dob),
      'Recorded By': getValue(entry.recordedBy || entry.provider),
      Source: getValue(entry.source || entry.documentType)
    }));
  }
};
