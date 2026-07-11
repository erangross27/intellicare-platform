module.exports = {
  title: '👩 Gynecology Consultations',
  columns: ['Date', 'Chief Complaint', 'Examination', 'Diagnosis', 'Gynecologist'],
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
      Examination: getValue(entry.examination || entry.exam),
      Diagnosis: getValue(entry.diagnosis || entry.impression),
      Gynecologist: getValue(entry.gynecologist || entry.provider)
    }));
  }
};
