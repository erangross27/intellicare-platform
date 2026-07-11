module.exports = {
  title: '📊 Response Assessment',
  columns: ['Date', 'Treatment', 'Response', 'Criteria', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Treatment: getValue(entry.treatment || entry.therapy),
      Response: getValue(entry.response || entry.responseCategory),
      Criteria: getValue(entry.criteria || entry.recist),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
