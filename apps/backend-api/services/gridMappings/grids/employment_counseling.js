module.exports = {
  title: '💼 Employment Counseling',
  columns: ['Date', 'Topic', 'Recommendations', 'Accommodations', 'Counselor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topic: getValue(entry.topic || entry.subject),
      Recommendations: getValue(entry.recommendations || entry.advice),
      Accommodations: getValue(entry.accommodations || entry.modifications),
      Counselor: getValue(entry.counselor || entry.provider)
    }));
  }
};
