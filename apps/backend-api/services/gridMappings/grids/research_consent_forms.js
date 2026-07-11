module.exports = {
  title: '📋 Research Consent Forms',
  columns: ['Date', 'Study Name', 'Consent Status', 'Witness', 'Investigator'],
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
      'Consent Status': getValue(entry.consentStatus || entry.status),
      Witness: getValue(entry.witness || entry.witnesses),
      Investigator: getValue(entry.investigator || entry.provider)
    }));
  }
};
