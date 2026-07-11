module.exports = {
  title: '💊 Pain Management Plan',
  columns: ['Date', 'Pain Level', 'Medications', 'Non-Pharmacologic', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Pain Level': getValue(entry.painLevel || entry.score),
      Medications: getValue(entry.medications || entry.pharmacologic),
      'Non-Pharmacologic': getValue(entry.nonPharmacologic || entry.alternativeTherapies),
      Provider: getValue(entry.provider)
    }));
  }
};
