module.exports = {
  title: '👁️ Monitoring Plan',
  columns: ['Date', 'Monitoring Type', 'Plan Details'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };

    const parseMonitoringText = (text, monitoringType, date) => {
      if (!text || text === '-') return [];

      const results = [];
      const textStr = String(text);

      // Check for timeframe-based structure (Short-term, Medium-term, Long-term)
      const timeframePattern = /(Short-term|Medium-term|Long-term)\s*(\([^)]+\))?:\s*([^.]+)/g;
      let match;
      let hasTimeframes = false;

      while ((match = timeframePattern.exec(textStr)) !== null) {
        hasTimeframes = true;
        const timeframe = match[1] + (match[2] || ''); // e.g., "Short-term (Monthly x 3)"
        const items = match[3];

        // Split by comma and create separate rows
        const itemList = items.split(',').map(item => item.trim()).filter(item => item.length > 0);

        itemList.forEach(item => {
          results.push({
            'Date': date,
            'Monitoring Type': `${monitoringType} - ${timeframe}`,
            'Plan Details': item
          });
        });
      }

      // If no timeframe structure found, try splitting by comma
      if (!hasTimeframes) {
        const items = textStr.split(',').map(item => item.trim()).filter(item => item.length > 0);

        if (items.length > 1) {
          // Multiple items - create separate rows
          items.forEach(item => {
            results.push({
              'Date': date,
              'Monitoring Type': monitoringType,
              'Plan Details': item
            });
          });
        } else {
          // Single item - return as-is
          results.push({
            'Date': date,
            'Monitoring Type': monitoringType,
            'Plan Details': textStr
          });
        }
      }

      return results;
    };

    const rows = [];

    categoryData.forEach(entry => {
      const date = entry.date ? new Date(entry.date).toLocaleDateString() : '-';

      // Laboratory monitoring
      if (entry.laboratory) {
        const labRows = parseMonitoringText(entry.laboratory, '🔬 Laboratory', date);
        rows.push(...labRows);
      }

      // Clinical assessment
      if (entry.clinicalAssessment) {
        const clinicalRows = parseMonitoringText(entry.clinicalAssessment, '🩺 Clinical Assessment', date);
        rows.push(...clinicalRows);
      }

      // Drug monitoring
      if (entry.drugMonitoring) {
        const drugRows = parseMonitoringText(entry.drugMonitoring, '💊 Drug Monitoring', date);
        rows.push(...drugRows);
      }

      // Imaging monitoring
      if (entry.imaging) {
        const imagingRows = parseMonitoringText(entry.imaging, '📷 Imaging', date);
        rows.push(...imagingRows);
      }

      // Vital signs monitoring
      if (entry.vitalSigns) {
        const vitalRows = parseMonitoringText(entry.vitalSigns, '❤️ Vital Signs', date);
        rows.push(...vitalRows);
      }

      // Generic parameter/frequency format (fallback)
      if (entry.parameter || entry.metric) {
        rows.push({
          'Date': date,
          'Monitoring Type': '📊 ' + getValue(entry.parameter || entry.metric),
          'Plan Details': 'Frequency: ' + getValue(entry.frequency || entry.schedule) +
                         (entry.alertThresholds ? '\nThresholds: ' + getValue(entry.alertThresholds) : '') +
                         (entry.provider ? '\nProvider: ' + getValue(entry.provider) : '')
        });
      }
    });

    return rows;
  }
};
