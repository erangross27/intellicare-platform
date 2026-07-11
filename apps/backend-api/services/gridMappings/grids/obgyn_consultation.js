module.exports = {
  title: '🤰 OB/GYN Consultation',
  columns: ['Date', 'Chief Complaint', 'Findings', 'Plan', 'Provider'],
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
      Findings: getValue(entry.findings || entry.assessment),
      Plan: getValue(entry.plan || entry.recommendations),
      Provider: getValue(entry.provider)
    }));
  }
};
