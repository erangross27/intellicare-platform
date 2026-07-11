module.exports = {
  title: '🔥 Inflammatory Bowel Reports',
  columns: ['Date', 'Disease Activity', 'Treatment', 'Response', 'Gastroenterologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Disease Activity': getValue(entry.diseaseActivity || entry.activity),
      Treatment: getValue(entry.treatment || entry.therapy),
      Response: getValue(entry.response || entry.outcome),
      Gastroenterologist: getValue(entry.gastroenterologist || entry.provider)
    }));
  }
};
