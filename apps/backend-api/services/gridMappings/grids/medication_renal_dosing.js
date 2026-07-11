module.exports = {
  title: '💊 Medication Renal Dosing',
  columns: ['Medication', 'Standard Dose', 'Renal Dose', 'eGFR', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Medication: getValue(entry.medication || entry.drug),
      'Standard Dose': getValue(entry.standardDose || entry.normalDose),
      'Renal Dose': getValue(entry.renalDose || entry.adjustedDose),
      eGFR: getValue(entry.egfr || entry.eGFR),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
