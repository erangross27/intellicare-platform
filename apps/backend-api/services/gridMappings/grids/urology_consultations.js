module.exports = {
  title: '🩺 Urology',
  columns: ['Date', 'Chief Complaint', 'Findings', 'Plan', 'Urologist'],
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
      Findings: getValue(entry.findings || entry.examination),
      Plan: getValue(entry.plan || entry.treatment),
      Urologist: getValue(entry.provider || entry.urologist)
    }));
  }
};
