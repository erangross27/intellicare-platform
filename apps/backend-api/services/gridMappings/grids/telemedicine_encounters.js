module.exports = {
  title: '💻 Telemedicine Encounters',
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
      Assessment: getValue(entry.assessment || entry.impression),
      Plan: getValue(entry.plan || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
