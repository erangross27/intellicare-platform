module.exports = {
  title: '🚑 Emergency Department',
  columns: ['Date', 'Chief Complaint', 'Triage', 'Diagnosis', 'Disposition'],
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
      Triage: getValue(entry.triage || entry.triageLevel || entry.acuity),
      Diagnosis: getValue(entry.diagnosis || entry.assessment),
      Disposition: getValue(entry.disposition || entry.outcome)
    }));
  }
};
