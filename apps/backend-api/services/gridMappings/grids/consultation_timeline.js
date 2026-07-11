module.exports = {
  title: '📅 Consultation Timeline',
  columns: ['Date', 'Specialty', 'Provider', 'Status', 'Next Step'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Specialty: getValue(entry.specialty || entry.department),
      Provider: getValue(entry.provider || entry.consultant),
      Status: getValue(entry.status),
      'Next Step': getValue(entry.nextStep || entry.followUp)
    }));
  }
};
