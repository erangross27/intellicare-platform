module.exports = {
  title: '🦴 Orthopedic Consultation',
  columns: ['Date', 'Chief Complaint', 'Examination', 'Plan', 'Orthopedist'],
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
      Examination: getValue(entry.examination || entry.findings),
      Plan: getValue(entry.plan || entry.recommendations),
      Orthopedist: getValue(entry.orthopedist || entry.provider)
    }));
  }
};
