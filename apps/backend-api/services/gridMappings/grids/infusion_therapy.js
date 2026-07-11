module.exports = {
  title: '💉 Infusion Therapy',
  columns: ['Date/Time', 'Medication', 'Dose', 'Rate', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Dose: getValue(entry.dose || entry.dosage),
      Rate: getValue(entry.rate || entry.infusionRate),
      Provider: getValue(entry.provider)
    }));
  }
};
