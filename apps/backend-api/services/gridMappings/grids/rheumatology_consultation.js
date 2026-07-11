module.exports = {
  title: '🦴 Rheumatology Consultation',
  columns: ['Date', 'Chief Complaint', 'Joint Exam', 'Diagnosis', 'Rheumatologist'],
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
      'Joint Exam': getValue(entry.jointExam || entry.examination),
      Diagnosis: getValue(entry.diagnosis || entry.assessment),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
