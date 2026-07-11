module.exports = {
  title: '🩺 Endocrinology Assessment',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.reason),
      Assessment: getValue(entry.assessment || entry.impression),
      Plan: getValue(entry.plan || entry.recommendations),
      Endocrinologist: getValue(entry.provider || entry.endocrinologist)
    }));
  }
};
