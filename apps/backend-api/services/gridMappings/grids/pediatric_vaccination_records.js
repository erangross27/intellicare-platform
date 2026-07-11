module.exports = {
  title: '💉 Pediatric Vaccination Records',
  columns: ['Date', 'Vaccine', 'Dose', 'Site', 'Administrator'],
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
      Administrator: getValue(entry.administrator || entry.provider)
    }));
  }
};
