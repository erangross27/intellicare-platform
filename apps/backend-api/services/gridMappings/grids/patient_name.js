module.exports = {
  title: '👤 Patient Name Records',
  columns: ['Date', 'Full Name', 'Previous Names', 'Source', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Full Name': getValue(entry.fullName || entry.name),
      'Previous Names': getValue(entry.previousNames || entry.aliases),
      Source: getValue(entry.source || entry.documentType),
      Provider: getValue(entry.provider)
    }));
  }
};
