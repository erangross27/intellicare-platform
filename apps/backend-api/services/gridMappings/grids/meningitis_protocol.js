module.exports = {
  title: '🦠 Meningitis Protocol',
  columns: ['Date/Time', 'Assessment', 'Antibiotics', 'Isolation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Assessment: getValue(entry.assessment || entry.clinicalFindings),
      Antibiotics: getValue(entry.antibiotics || entry.medications),
      Isolation: getValue(entry.isolation || entry.precautions),
      Provider: getValue(entry.provider)
    }));
  }
};
