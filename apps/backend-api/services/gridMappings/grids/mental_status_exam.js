module.exports = {
  title: '🧠 Mental Status Exam',
  columns: ['Date', 'Appearance', 'Mood', 'Thought Process', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Appearance: getValue(entry.appearance || entry.generalAppearance),
      Mood: getValue(entry.mood || entry.affect),
      'Thought Process': getValue(entry.thoughtProcess || entry.cognition),
      Provider: getValue(entry.provider)
    }));
  }
};
