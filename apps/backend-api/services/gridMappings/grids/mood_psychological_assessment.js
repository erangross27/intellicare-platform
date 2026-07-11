module.exports = {
  title: '🧠 Mood & Psychological Assessment',
  columns: ['Date', 'Mood', 'Depression Score', 'Anxiety Score', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Mood: getValue(entry.mood || entry.affect),
      'Depression Score': getValue(entry.depressionScore || entry.phq9),
      'Anxiety Score': getValue(entry.anxietyScore || entry.gad7),
      Provider: getValue(entry.provider)
    }));
  }
};
