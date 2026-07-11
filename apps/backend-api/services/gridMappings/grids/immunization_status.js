module.exports = {
  title: '💉 Immunization Status',
  columns: ['Date', 'Vaccine', 'Dose', 'Site', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Vaccine: getValue(entry.vaccine || entry.vaccineName),
      Dose: getValue(entry.dose || entry.doseNumber),
      Site: getValue(entry.site || entry.administrationSite),
      Provider: getValue(entry.provider)
    }));
  }
};
