module.exports = {
  title: '👥 Partner Involvement - Diabetes',
  columns: ['Date', 'Education Provided', 'Role', 'Support Level', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Education Provided': getValue(entry.educationProvided || entry.education),
      Role: getValue(entry.role || entry.involvement),
      'Support Level': getValue(entry.supportLevel || entry.engagement),
      Provider: getValue(entry.provider)
    }));
  }
};
