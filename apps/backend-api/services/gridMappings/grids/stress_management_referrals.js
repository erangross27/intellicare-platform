module.exports = {
  title: '🧘 Stress Management Referrals',
  columns: ['Date', 'Referral Type', 'Contact', 'Reason', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Referral Type': getValue(entry.referralType || entry.type),
      Contact: getValue(entry.contact || entry.contactInformation),
      Reason: getValue(entry.reason || entry.indication),
      Provider: getValue(entry.provider)
    }));
  }
};
