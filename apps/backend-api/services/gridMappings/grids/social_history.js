module.exports = {
  title: '🚬 Social History',
  columns: ['Category', 'Status', 'Details', 'Date'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const strVal = String(val).trim();
      return strVal || defaultVal;
    };

    const gridData = [];

    // Each entry might have tobacco, alcohol, drugs, occupation
    categoryData.forEach(entry => {
      const addRow = (category, statusObj) => {
        if (statusObj) {
          const status = typeof statusObj === 'object' ? (statusObj.status || statusObj.use || 'Unknown') : String(statusObj);
          const details = typeof statusObj === 'object' ?
            [statusObj.amount, statusObj.frequency, statusObj.duration, statusObj.details].filter(x => x).join(', ') :
            '-';

          gridData.push({
            Category: category,
            Status: getValue(status),
            Details: getValue(details),
            Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-'
          });
        }
      };

      addRow('Tobacco', entry.tobacco);
      addRow('Alcohol', entry.alcohol);
      addRow('Drugs', entry.drugs);

      if (entry.occupation) {
        gridData.push({
          Category: 'Occupation',
          Status: getValue(entry.occupation),
          Details: getValue(entry.occupationDetails || entry.employmentStatus),
          Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-'
        });
      }
    });

    return gridData;
  }
};
