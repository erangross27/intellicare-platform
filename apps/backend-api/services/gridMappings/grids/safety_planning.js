module.exports = {
  title: '🛡️ Safety Planning',
  columns: ['Date', 'Risk Factors', 'Safety Strategies', 'Contacts', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Risk Factors': getValue(entry.riskFactors || entry.risks),
      'Safety Strategies': getValue(entry.safetyStrategies || entry.strategies),
      Contacts: getValue(entry.contacts || entry.emergencyContacts),
      Provider: getValue(entry.provider)
    }));
  }
};
