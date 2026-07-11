module.exports = {
  title: '🔬 Research Study Enrollment',
  columns: ['Date', 'Study Name', 'Consent Given', 'Status', 'Investigator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Study Name': getValue(entry.studyName || entry.study),
      'Consent Given': getValue(entry.consentGiven || entry.consent),
      Status: getValue(entry.status || entry.enrollmentStatus),
      Investigator: getValue(entry.investigator || entry.provider)
    }));
  }
};
