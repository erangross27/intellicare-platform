module.exports = {
  title: '💪 Neuromuscular Disorder',
  columns: ['Date', 'Disorder', 'Weakness Pattern', 'Treatment', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Disorder: getValue(entry.disorder || entry.diagnosis),
      'Weakness Pattern': getValue(entry.weaknessPattern || entry.distribution),
      Treatment: getValue(entry.treatment || entry.therapy),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
