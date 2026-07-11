module.exports = {
  title: 'CYP450 Panel Results',
  columns: ['Date', 'CYP2D6 Genotype', 'CYP2D6 Phenotype', 'CYP2C19 Genotype', 'Warfarin Sensitivity'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'CYP2D6 Genotype': getValue(entry.cyp2d6Genotype),
      'CYP2D6 Phenotype': getValue(entry.cyp2d6PhenotypeClassification),
      'CYP2C19 Genotype': getValue(entry.cyp2c19Genotype),
      'Warfarin Sensitivity': getValue(entry.warfarinSensitivityCategory)
    }));
  }
};
