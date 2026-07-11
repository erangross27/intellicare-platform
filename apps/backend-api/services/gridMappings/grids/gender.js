module.exports = {
  title: '⚧️ Gender Records',
  columns: ['Date', 'Gender', 'Recorded By', 'Source', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Gender: getValue(entry.gender || entry.value),
      'Recorded By': getValue(entry.recordedBy || entry.provider),
      Source: getValue(entry.source || entry.documentType),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
