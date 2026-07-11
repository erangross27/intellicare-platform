module.exports = {
  title: '💊 Pharmacy Consultation',
  columns: ['Date', 'Indication', 'Recommendations', 'Drug Interactions', 'Pharmacist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Recommendations: getValue(entry.recommendations || entry.advice),
      'Drug Interactions': getValue(entry.drugInteractions || entry.interactions),
      Pharmacist: getValue(entry.pharmacist || entry.provider)
    }));
  }
};
