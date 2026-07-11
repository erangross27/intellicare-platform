module.exports = {
  title: '📏 Pediatric Growth Charts',
  columns: ['Date', 'Age', 'Weight', 'Height', 'Head Circumference'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.ageAtVisit),
      Weight: getValue(entry.weight || entry.weightKg),
      Height: getValue(entry.height || entry.heightCm),
      'Head Circumference': getValue(entry.headCircumference || entry.hc)
    }));
  }
};
