module.exports = {
  title: '💉 Pre-Anesthesia Evaluation',
  columns: ['Date', 'ASA Class', 'Anesthesia Plan', 'Concerns', 'Anesthesiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'ASA Class': getValue(entry.asaClass || entry.asaStatus),
      'Anesthesia Plan': getValue(entry.anesthesiaPlan || entry.plan),
      Concerns: getValue(entry.concerns || entry.riskFactors),
      Anesthesiologist: getValue(entry.anesthesiologist || entry.provider)
    }));
  }
};
