module.exports = {
  title: '🚨 Emergency Assessment',
  columns: ['Date', 'Chief Complaint', 'Triage Level', 'Assessment', 'Plan'],
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
      'Triage Level': getValue(entry.triageLevel || entry.esi),
      Assessment: getValue(entry.assessment || entry.impression),
      Plan: getValue(entry.plan || entry.treatment)
    }));
  }
};
