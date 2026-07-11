module.exports = {
  title: '💉 Anesthesia Details',
  columns: ['Date', 'Anesthesia Type', 'Agents Used', 'Duration', 'Anesthesiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Anesthesia Type': getValue(entry.anesthesiaType || entry.type),
      'Agents Used': getValue(entry.agentsUsed || entry.agents),
      Duration: getValue(entry.duration || entry.time),
      Anesthesiologist: getValue(entry.anesthesiologist || entry.provider)
    }));
  }
};
