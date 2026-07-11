module.exports = {
  title: '👨‍⚕️ Family Medicine Assessment',
  columns: ['Date', 'Chief Complaint', 'Assessment', 'Plan', 'Physician'],
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
      Plan: getValue(entry.plan || entry.treatment),
      Physician: getValue(entry.physician || entry.provider)
    }));
  }
};
