module.exports = {
  title: '🏥 Hospital Admission Notes',
  columns: ['Date', 'Admitting Diagnosis', 'Chief Complaint', 'Assessment', 'Attending'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Admitting Diagnosis': getValue(entry.admittingDiagnosis || entry.diagnosis),
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Assessment: getValue(entry.assessment || entry.findings),
      Attending: getValue(entry.attending || entry.provider)
    }));
  }
};
