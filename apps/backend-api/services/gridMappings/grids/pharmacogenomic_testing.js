module.exports = {
  title: 'Pharmacogenomic Testing',
  columns: ['Date', 'Testing ID', 'CYP2D6 Status', 'CYP2C19 Status', 'Platform'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Testing ID': getValue(entry.pharmacogenomicTestingId),
      'CYP2D6 Status': getValue(entry.cyp2d6MetabolizerStatus),
      'CYP2C19 Status': getValue(entry.cyp2c19MetabolizerStatus),
      Platform: getValue(entry.testingPlatformUsed),
      _summary: [
        entry.cyp2d6MetabolizerStatus ? `CYP2D6: ${entry.cyp2d6MetabolizerStatus}` : '',
        entry.cyp2c19MetabolizerStatus ? `CYP2C19: ${entry.cyp2c19MetabolizerStatus}` : '',
        entry.calculatedWarfarinSensitivity ? `Warfarin: ${entry.calculatedWarfarinSensitivity}` : '',
        entry.testingPlatformUsed ? `Platform: ${entry.testingPlatformUsed}` : '',
      ].filter(Boolean).join(' | ') || '-'
    }));
  }
};
