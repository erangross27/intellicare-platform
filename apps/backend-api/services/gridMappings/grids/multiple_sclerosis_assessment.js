module.exports = {
  title: '🧠 Multiple Sclerosis Assessment',
  columns: ['Date', 'EDSS Score', 'Relapses', 'Treatment', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'EDSS Score': getValue(entry.edssScore || entry.edss),
      Relapses: getValue(entry.relapses || entry.exacerbations),
      Treatment: getValue(entry.treatment || entry.dmt),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
