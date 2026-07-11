module.exports = {
  title: '⚡ Risk Factors',
  columns: ['Factor', 'Level', 'Assessment Date'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Flatten array of factors into individual rows
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';
      const level = getValue(entry.level || entry.severity, 'Moderate');

      if (Array.isArray(entry.factors)) {
        // Create a separate row for each factor
        entry.factors.forEach(factor => {
          const factorText = typeof factor === 'object' ? getValue(factor.factor) : getValue(factor);

          // Determine level based on category or severity
          let factorLevel;
          if (typeof factor === 'object') {
            if (factor.category === 'Protective') {
              factorLevel = 'Protective';
            } else {
              factorLevel = getValue(factor.severity || factor.level || factor.category, level);
            }
          } else {
            factorLevel = level;
          }

          rows.push({
            'Factor': factorText,
            'Level': factorLevel,
            'Assessment Date': date
          });
        });
      } else if (entry.factors) {
        // Single factor as string
        rows.push({
          'Factor': getValue(entry.factors),
          'Level': level,
          'Assessment Date': date
        });
      }
    });

    return rows;
  }
};
