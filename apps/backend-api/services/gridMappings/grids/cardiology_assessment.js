module.exports = {
  title: '❤️ Cardiology Assessment',
  columns: ['Date', 'Test Type', 'Key Findings', 'Details'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const formatObject = (obj) => {
      if (!obj || typeof obj !== 'object') return '-';
      return Object.entries(obj)
        .filter(([key, val]) => val !== null && val !== undefined && val !== '')
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n');  // Use line breaks instead of commas for readability
    };

    // Flatten EKG and Echo data into separate rows
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Add EKG/Electrocardiogram row if present
      if (entry.electrocardiogram) {
        const ekg = entry.electrocardiogram;
        rows.push({
          'Date': date,
          'Test Type': 'Electrocardiogram (EKG)',
          'Key Findings': getValue(ekg.rhythm),
          'Details': formatObject({
            'Rate': ekg.rate ? `${ekg.rate} bpm` : undefined,
            'Axis': ekg.axis,
            'QRS Duration': ekg.qrsDuration,
            'QTc': ekg.qtcInterval,
            'ST Changes': ekg.stChanges
          })
        });
      }

      // Add Echo/Echocardiogram row if present
      if (entry.echocardiogram) {
        const echo = entry.echocardiogram;
        rows.push({
          'Date': date,
          'Test Type': 'Echocardiogram',
          'Key Findings': getValue(echo.ejectionFraction ? `EF ${echo.ejectionFraction}` : echo.summary),
          'Details': formatObject({
            'LV Dimensions': echo.lvDimensions,
            'Wall Motion': echo.wallMotion,
            'LA Size': echo.laSize,
            'Valves': echo.valvularFindings
          })
        });
      }

      // Fallback for non-standard format
      if (!entry.electrocardiogram && !entry.echocardiogram) {
        rows.push({
          'Date': date,
          'Test Type': getValue(entry.testType || 'Assessment'),
          'Key Findings': getValue(entry.assessment || entry.impression),
          'Details': getValue(entry.plan || entry.recommendations || entry.details)
        });
      }
    });

    return rows;
  }
};
