module.exports = {
  title: '📞 Communication Preferences',
  columns: ['Type', 'Preference', 'Contact Info', 'Best Time', 'Language'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Type: getValue(entry.type || entry.communicationType),
      Preference: getValue(entry.preference || entry.method),
      'Contact Info': getValue(entry.contactInfo || entry.contact),
      'Best Time': getValue(entry.bestTime || entry.preferredTime),
      Language: getValue(entry.language || entry.preferredLanguage)
    }));
  }
};
