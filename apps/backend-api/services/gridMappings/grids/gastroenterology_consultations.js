module.exports = {
  title: '🫃 Gastroenterology',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Gastroenterologist'],
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
      Gastroenterologist: getValue(entry.provider || entry.gastroenterologist)
    }));
  }
};
