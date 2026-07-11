module.exports = {
  title: '🧠 Neurodevelopmental Assessment',
  columns: ['Date', 'Age', 'Domain', 'Score', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.ageMonths),
      Domain: getValue(entry.domain || entry.developmentalArea),
      Score: getValue(entry.score || entry.assessment),
      Provider: getValue(entry.provider)
    }));
  }
};
