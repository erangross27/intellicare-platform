module.exports = {
  title: '💊 Infliximab Drug Monitoring',
  columns: ['Date', 'Trough Level', 'Antibody Level', 'Dose', 'Next Infusion'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Trough Level': getValue(entry.troughLevel || entry.level),
      'Antibody Level': getValue(entry.antibodyLevel || entry.antiDrugAntibody),
      Dose: getValue(entry.dose || entry.dosage),
      'Next Infusion': entry.nextInfusion ? new Date(entry.nextInfusion).toLocaleDateString() : '-'
    }));
  }
};
