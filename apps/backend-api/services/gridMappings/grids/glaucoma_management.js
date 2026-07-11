module.exports = {
  title: '👁️ Glaucoma Management',
  columns: ['Date', 'IOP', 'Medications', 'Visual Field', 'Ophthalmologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      IOP: getValue(entry.iop || entry.pressure),
      Medications: getValue(entry.medications || entry.drops),
      'Visual Field': getValue(entry.visualField || entry.vf),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
