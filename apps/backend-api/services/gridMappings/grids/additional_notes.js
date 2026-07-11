module.exports = {
  title: '📝 Additional Notes',
  columns: ['Date', 'Type', 'Note', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const strVal = String(val).trim();
      return strVal || defaultVal;
    };

    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.category || entry.noteType, 'Clinical Note'),
      Note: getValue(entry.note || entry.notes || entry.content || entry.text || entry.description),
      Provider: getValue(entry.provider || entry.author || entry.documentedBy)
    }));
  }
};
