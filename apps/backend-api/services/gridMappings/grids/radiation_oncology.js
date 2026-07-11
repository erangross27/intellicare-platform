module.exports = {
  title: '☢️ Radiation Oncology',
  columns: ['Date', 'Site', 'Dose', 'Fractions', 'Radiation Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Site: getValue(entry.site || entry.treatmentSite),
      Dose: getValue(entry.dose || entry.totalDose),
      Fractions: getValue(entry.fractions || entry.numberOfFractions),
      'Radiation Oncologist': getValue(entry.radiationOncologist || entry.provider)
    }));
  }
};
