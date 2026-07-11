module.exports = {
  title: '🩸 Estimated Blood Loss',
  columns: ['Date', 'Procedure', 'EBL', 'Replaced', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      EBL: getValue(entry.ebl || entry.bloodLoss),
      Replaced: getValue(entry.replaced || entry.replacement),
      Provider: getValue(entry.provider || entry.surgeon)
    }));
  }
};
