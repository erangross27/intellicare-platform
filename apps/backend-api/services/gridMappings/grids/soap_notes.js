module.exports = {
  title: '📝 SOAP Notes',
  columns: ['Date', 'Subjective', 'Objective', 'Assessment', 'Plan'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Subjective: getValue(entry.subjective || entry.s),
      Objective: getValue(entry.objective || entry.o),
      Assessment: getValue(entry.assessment || entry.a),
      Plan: getValue(entry.plan || entry.p)
    }));
  }
};
