module.exports = {
  title: '📋 Informed Consent',
  columns: ['Date', 'Procedure/Treatment', 'Consent Type', 'Provider', 'Witness'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Procedure/Treatment': getValue(entry.procedure || entry.treatment),
      'Consent Type': getValue(entry.consentType || entry.type),
      Provider: getValue(entry.provider),
      Witness: getValue(entry.witness)
    }));
  }
};
