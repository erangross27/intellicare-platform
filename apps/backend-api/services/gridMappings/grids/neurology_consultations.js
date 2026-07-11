module.exports = {
  title: '🧠 Neurology',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Neurologist'],
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
      Neurologist: getValue(entry.provider || entry.neurologist)
    }));
  }
};
