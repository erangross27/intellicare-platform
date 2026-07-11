module.exports = {
  title: '💊 Reproductive Health Counseling',
  columns: ['Date', 'Topic', 'Options Discussed', 'Decision', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Topic: getValue(entry.topic || entry.subject),
      'Options Discussed': getValue(entry.optionsDiscussed || entry.options),
      Decision: getValue(entry.decision || entry.patientChoice),
      Provider: getValue(entry.provider)
    }));
  }
};
