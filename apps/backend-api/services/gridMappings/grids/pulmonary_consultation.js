module.exports = {
  title: '🫁 Pulmonary Consultation',
  columns: ['Date', 'Chief Complaint', 'PFT Results', 'Diagnosis', 'Pulmonologist'],
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
      'PFT Results': getValue(entry.pftResults || entry.pulmonaryFunctionTest),
      Diagnosis: getValue(entry.diagnosis || entry.assessment),
      Pulmonologist: getValue(entry.pulmonologist || entry.provider)
    }));
  }
};
