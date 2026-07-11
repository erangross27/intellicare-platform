module.exports = {
  title: '🏥 Triage Data',
  columns: ['Date/Time', 'Chief Complaint', 'Severity', 'Disposition', 'Triage Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Severity: getValue(entry.severity || entry.acuity),
      Disposition: getValue(entry.disposition || entry.decision),
      'Triage Nurse': getValue(entry.triageNurse || entry.provider)
    }));
  }
};
