module.exports = {
  title: '🦴 Connective Tissue Disease Assessment',
  columns: ['Date', 'Disease Type', 'Symptoms', 'Labs', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Disease Type': getValue(entry.diseaseType || entry.diagnosis),
      Symptoms: getValue(entry.symptoms || entry.presentation),
      Labs: getValue(entry.labs || entry.labResults),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
