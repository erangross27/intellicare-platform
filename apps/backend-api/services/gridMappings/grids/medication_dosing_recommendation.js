module.exports = {
  title: '💊 Medication Dosing Recommendation',
  columns: ['Date', 'Generic Name', 'Brand Names', 'Therapeutic Class', 'Adult Dose', 'Route'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Generic Name': getValue(entry.medicationGenericName),
      'Brand Names': Array.isArray(entry.medicationBrandNames) ? entry.medicationBrandNames.join(', ') : getValue(entry.medicationBrandNames),
      'Therapeutic Class': getValue(entry.therapeuticClass),
      'Adult Dose': getValue(entry.standardAdultDose),
      Route: getValue(entry.routeOfAdministration),
    }));
  }
};
