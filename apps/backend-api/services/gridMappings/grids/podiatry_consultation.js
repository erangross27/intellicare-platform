module.exports = {
  title: '🦶 Podiatry Consultation',
  columns: ['Date', 'Chief Complaint', 'Examination', 'Plan', 'Podiatrist'],
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
      Plan: getValue(entry.plan || entry.treatment),
      Podiatrist: getValue(entry.podiatrist || entry.provider)
    }));
  }
};
