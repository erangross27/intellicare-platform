module.exports = {
  title: '🧠 Psychiatry Consultation',
  columns: ['Date', 'Chief Complaint', 'Mental Status', 'Diagnosis', 'Plan'],
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
      'Mental Status': getValue(entry.mentalStatus || entry.mse),
      Diagnosis: getValue(entry.diagnosis || entry.psychiatricDiagnosis),
      Plan: getValue(entry.plan || entry.treatment)
    }));
  }
};
