module.exports = {
  title: '👁️ Ophthalmology Consultation',
  columns: ['Date', 'Chief Complaint', 'Visual Acuity', 'Findings', 'Ophthalmologist'],
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
      'Visual Acuity': getValue(entry.visualAcuity || entry.va),
      Findings: getValue(entry.findings || entry.examination),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
