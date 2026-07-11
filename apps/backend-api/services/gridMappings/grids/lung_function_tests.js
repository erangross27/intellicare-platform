module.exports = {
  title: '🫁 Lung Function',
  columns: ['Date', 'FEV1', 'FVC', 'FEV1/FVC', 'Interpretation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      FEV1: getValue(entry.fev1 || entry.forcedExpiratoryVolume),
      FVC: getValue(entry.fvc || entry.forcedVitalCapacity),
      ratio: getValue(entry.ratio || entry.fev1FvcRatio),
      Interpretation: getValue(entry.interpretation || entry.results)
    }));
  }
};
