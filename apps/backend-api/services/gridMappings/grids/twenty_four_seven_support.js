module.exports = {
  title: '☎️ 24/7 Support',
  columns: ['Date', 'Contact Type', 'Phone Number', 'Reason for Call', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Contact Type': getValue(entry.contactType || entry.type),
      'Phone Number': getValue(entry.phoneNumber || entry.phone),
      'Reason for Call': getValue(entry.reasonForCall || entry.reason),
      Provider: getValue(entry.provider)
    }));
  }
};
