module.exports = {
  title: '👶 Birth Plan',
  columns: ['Date', 'Delivery Preferences', 'Pain Management', 'Support Person', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Delivery Preferences': getValue(entry.deliveryPreferences || entry.preferences),
      'Pain Management': getValue(entry.painManagement || entry.analgesia),
      'Support Person': getValue(entry.supportPerson || entry.birthPartner),
      Provider: getValue(entry.provider)
    }));
  }
};
