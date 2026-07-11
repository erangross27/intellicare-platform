module.exports = {
  title: '☢️ Radiation Therapy Records',
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
      Dose: getValue(entry.dose || entry.dosage),
      Fractions: getValue(entry.fractions || entry.fractionNumber),
      'Radiation Oncologist': getValue(entry.radiationOncologist || entry.provider)
    }));
  }
};
