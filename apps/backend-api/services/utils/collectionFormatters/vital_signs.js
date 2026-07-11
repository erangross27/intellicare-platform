/**
 * Vital Signs Formatter
 * Formats vital signs records for Claude AI context
 */

function formatDate(dateValue) {
  if (!dateValue) return 'Unknown date';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (err) {
    return 'Unknown date';
  }
}

module.exports = function formatVitalSigns(doc) {
  const lines = [];

  // Date/Time
  if (doc.recordedDate || doc.date || doc.measurementDate) {
    lines.push(`Recorded: ${formatDate(doc.recordedDate || doc.date || doc.measurementDate)}`);
  }
  if (doc.recordedTime || doc.time) {
    lines.push(`Time: ${doc.recordedTime || doc.time}`);
  }

  // Blood Pressure
  if (doc.bloodPressure) {
    if (typeof doc.bloodPressure === 'object') {
      const sys = doc.bloodPressure.systolic || doc.bloodPressure.sys;
      const dia = doc.bloodPressure.diastolic || doc.bloodPressure.dia;
      if (sys && dia) {
        lines.push(`Blood Pressure: ${sys}/${dia} mmHg`);
      }
    } else {
      lines.push(`Blood Pressure: ${doc.bloodPressure}`);
    }
  } else if (doc.systolic && doc.diastolic) {
    lines.push(`Blood Pressure: ${doc.systolic}/${doc.diastolic} mmHg`);
  }

  // Heart Rate
  if (doc.heartRate || doc.pulse) {
    const hr = doc.heartRate || doc.pulse;
    lines.push(`Heart Rate: ${hr} bpm`);
  }

  // Temperature
  if (doc.temperature || doc.temp) {
    const temp = doc.temperature || doc.temp;
    const unit = doc.temperatureUnit || doc.tempUnit || '°F';
    lines.push(`Temperature: ${temp} ${unit}`);
  }

  // Respiratory Rate
  if (doc.respiratoryRate || doc.respRate) {
    const rr = doc.respiratoryRate || doc.respRate;
    lines.push(`Respiratory Rate: ${rr} breaths/min`);
  }

  // Oxygen Saturation
  if (doc.oxygenSaturation || doc.spo2 || doc.o2Sat) {
    const o2 = doc.oxygenSaturation || doc.spo2 || doc.o2Sat;
    lines.push(`Oxygen Saturation: ${o2}%`);
  }

  // Weight
  if (doc.weight) {
    const unit = doc.weightUnit || 'kg';
    lines.push(`Weight: ${doc.weight} ${unit}`);
  }

  // Height
  if (doc.height) {
    const unit = doc.heightUnit || 'cm';
    lines.push(`Height: ${doc.height} ${unit}`);
  }

  // BMI
  if (doc.bmi) {
    lines.push(`BMI: ${doc.bmi}`);
  }

  // Pain Scale
  if (doc.painScale !== undefined) {
    lines.push(`Pain Scale: ${doc.painScale}/10`);
  }

  // Recorded By
  if (doc.recordedBy || doc.measuredBy) {
    lines.push(`Recorded By: ${doc.recordedBy || doc.measuredBy}`);
  }

  // Location
  if (doc.location) {
    lines.push(`Location: ${doc.location}`);
  }

  // Notes
  if (doc.notes) {
    lines.push(`Notes: ${doc.notes}`);
  }

  return lines.join('\n');
};
