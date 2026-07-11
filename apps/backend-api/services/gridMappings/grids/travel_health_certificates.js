module.exports = {
  title: '✈️ Travel Health Certificates',
  columns: ['Date', 'Destination', 'Vaccinations', 'Valid Until', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Destination: getValue(entry.destination || entry.country),
      Vaccinations: getValue(entry.vaccinations || entry.immunizations),
      'Valid Until': entry.validUntil ? new Date(entry.validUntil).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
