module.exports = {
  title: '☢️ Radiation Oncology',
  columns: ['Date', 'Cancer Type', 'Treatment Plan', 'Dose', 'Radiation Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cancer Type': getValue(entry.cancerType || entry.diagnosis),
      'Treatment Plan': getValue(entry.treatmentPlan || entry.plan),
      Dose: getValue(entry.dose || entry.radiationDose),
      'Radiation Oncologist': getValue(entry.radiationOncologist || entry.provider)
    }));
  }
};
