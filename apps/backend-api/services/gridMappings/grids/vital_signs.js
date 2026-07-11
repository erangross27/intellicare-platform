module.exports = {
  title: '❤️ Vital Signs',
  columns: ['Date', 'BP', 'HR', 'Temp', 'Weight', 'O2'],
  mapper: (entry) => {
    const formatValue = (val) => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return '-';
      }
      return String(val).trim() || '-';
    };

    let tempDisplay = formatValue(entry.temperature);
    if (tempDisplay !== '-' && !tempDisplay.includes('°')) {
      tempDisplay = `${tempDisplay}°`;
    }

    let hrDisplay = formatValue(entry.heartRate);
    if (hrDisplay !== '-' && !hrDisplay.toLowerCase().includes('bpm')) {
      hrDisplay = `${hrDisplay} bpm`;
    }

    let o2Display = formatValue(entry.oxygenSaturation);
    if (o2Display !== '-' && !o2Display.includes('%')) {
      o2Display = `${o2Display}%`;
    }

    return {
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      BP: formatValue(entry.bloodPressure),
      HR: hrDisplay,
      Temp: tempDisplay,
      Weight: formatValue(entry.weight),
      O2: o2Display
    };
  }
};
