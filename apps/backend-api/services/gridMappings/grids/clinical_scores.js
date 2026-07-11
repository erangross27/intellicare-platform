module.exports = {
  title: '📊 Clinical Scores',
  columns: ['Date', 'Score Name', 'Value', 'Risk/Interpretation'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    // Flatten nested score objects (CHA2DS2VASc, HASBLED, etc.)
    const rows = [];
    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Check for CHA2DS2VASc score
      if (entry.CHA2DS2VASc) {
        rows.push({
          'Date': date,
          'Score Name': 'CHA2DS2-VASc',
          'Value': getValue(entry.CHA2DS2VASc.score),
          'Risk/Interpretation': getValue(entry.CHA2DS2VASc.risk || entry.CHA2DS2VASc.recommendation)
        });
      }

      // Check for HAS-BLED score
      if (entry.HASBLED) {
        rows.push({
          'Date': date,
          'Score Name': 'HAS-BLED',
          'Value': getValue(entry.HASBLED.score),
          'Risk/Interpretation': getValue(entry.HASBLED.risk)
        });
      }

      // Fallback for other score formats
      if (!entry.CHA2DS2VASc && !entry.HASBLED) {
        rows.push({
          'Date': date,
          'Score Name': getValue(entry.scoreName || entry.name || entry.type),
          'Value': getValue(entry.value || entry.score || entry.result),
          'Risk/Interpretation': getValue(entry.interpretation || entry.risk || entry.category)
        });
      }
    });

    return rows;
  }
};
