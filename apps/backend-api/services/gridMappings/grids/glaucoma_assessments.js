module.exports = {
  title: '👁️ Glaucoma Assessments',
  columns: ['Date', 'IOP', 'Cup-to-Disc Ratio', 'Visual Field', 'Ophthalmologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      IOP: getValue(entry.iop || entry.intraocularpressure),
      'Cup-to-Disc Ratio': getValue(entry.cupToDiscRatio || entry.cdr),
      'Visual Field': getValue(entry.visualField || entry.vf),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
