module.exports = {
  title: '🧠 Neurology Consultation',
  columns: ['Date', 'Chief Complaint', 'Findings', 'Plan', 'Neurologist'],
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
      Findings: getValue(entry.findings || entry.assessment),
      Plan: getValue(entry.plan || entry.recommendations),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
