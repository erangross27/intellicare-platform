module.exports = {
  title: '🧠 Psychiatric History',
  columns: ['Date', 'Diagnosis', 'Treatment History', 'Hospitalizations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.condition),
      'Treatment History': getValue(entry.treatmentHistory || entry.treatments),
      Hospitalizations: getValue(entry.hospitalizations || entry.admissions),
      Provider: getValue(entry.provider)
    }));
  }
};
