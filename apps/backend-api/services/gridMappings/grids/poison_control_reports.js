module.exports = {
  title: '☠️ Poison Control Reports',
  columns: ['Date/Time', 'Substance', 'Amount', 'Treatment', 'Toxicologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Substance: getValue(entry.substance || entry.poison),
      Amount: getValue(entry.amount || entry.dose),
      Treatment: getValue(entry.treatment || entry.interventions),
      Toxicologist: getValue(entry.toxicologist || entry.provider)
    }));
  }
};
