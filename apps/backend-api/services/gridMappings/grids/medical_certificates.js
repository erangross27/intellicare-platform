module.exports = {
  title: '📜 Medical Certificates',
  columns: ['Date', 'Certificate Type', 'Purpose', 'Valid Until', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Certificate Type': getValue(entry.certificateType || entry.type),
      Purpose: getValue(entry.purpose || entry.reason),
      'Valid Until': entry.validUntil ? new Date(entry.validUntil).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
