module.exports = {
  title: '👥 Support Group Referral',
  columns: ['Date', 'Group Type', 'Referral Reason', 'Contact Info', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Group Type': getValue(entry.groupType || entry.type),
      'Referral Reason': getValue(entry.referralReason || entry.reason),
      'Contact Info': getValue(entry.contactInfo || entry.contact),
      Provider: getValue(entry.provider)
    }));
  }
};
