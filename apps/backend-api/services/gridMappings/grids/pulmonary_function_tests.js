module.exports = {
  title: '🫁 Pulmonary Function Tests',
  columns: ['Date', 'Pre-FEV1', 'Post-FEV1', 'Reversibility', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    return categoryData.map(entry => {
      // Extract FEV1 values from nested structure
      let preFEV1 = '-';
      let postFEV1 = '-';

      // Pre-bronchodilator FEV1
      if (entry.preBronchodilator?.fev1?.value) {
        preFEV1 = getValue(entry.preBronchodilator.fev1.value);
      } else if (entry.fev1) {
        preFEV1 = getValue(entry.fev1);
      }

      // Post-bronchodilator FEV1
      if (entry.postBronchodilator?.fev1?.value) {
        const value = getValue(entry.postBronchodilator.fev1.value);
        const change = entry.postBronchodilator.fev1.percentChange
          ? ` (${entry.postBronchodilator.fev1.percentChange})`
          : '';
        postFEV1 = value + change;
      }

      return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
        'Pre-FEV1': preFEV1,
        'Post-FEV1': postFEV1,
        Reversibility: getValue(entry.reversibility || entry.interpretation),
        Provider: getValue(entry.provider || entry.pulmonologist || entry.orderedBy)
      };
    });
  }
};
