module.exports = {
  title: '📝 Initial Assessment',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Assessment: getValue(entry.assessment || entry.findings),
      Plan: getValue(entry.plan || entry.treatmentPlan),
      Provider: getValue(entry.provider)
    }));
  }
};
