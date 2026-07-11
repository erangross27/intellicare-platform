/**
 * Grid Data Formatter Service
 * Handles all data formatting for medical grids
 * Ensures consistent formatting across all 184 GET functions
 */

const moment = require('moment');

class GridDataFormatterService {
  constructor() {
    this.locale = 'en-US';
    this.timezone = 'America/New_York'; // Default, should be set per practice
    this.dateFormat = 'MM/DD/YYYY';
    this.timeFormat = 'hh:mm A';
    this.currency = 'USD';
  }

  /**
   * Set locale for formatting
   */
  setLocale(locale, timezone = null) {
    this.locale = locale;
    if (timezone) {
      this.timezone = timezone;
    }

    // Adjust for Israeli locale
    if (locale === 'he-IL') {
      this.dateFormat = 'DD/MM/YYYY';
      this.timeFormat = 'HH:mm';
      this.currency = 'ILS';
    }
  }

  /**
   * Master format function - routes to appropriate formatter
   */
  format(value, type, options = {}) {
    if (value == null || value === undefined) {
      return this.formatNull();
    }

    switch (type) {
      case 'date':
        return this.formatDate(value, options);
      case 'time':
        return this.formatTime(value, options);
      case 'datetime':
        return this.formatDateTime(value, options);
      case 'currency':
        return this.formatCurrency(value, options);
      case 'percentage':
        return this.formatPercentage(value, options);
      case 'boolean':
        return this.formatBoolean(value, options);
      case 'number':
        return this.formatNumber(value, options);
      case 'status':
        return this.formatStatus(value, options);
      case 'severity':
        return this.formatSeverity(value, options);
      case 'phone':
        return this.formatPhone(value, options);
      case 'email':
        return this.formatEmail(value, options);
      case 'address':
        return this.formatAddress(value, options);
      case 'name':
        return this.formatName(value, options);
      case 'medical':
        return this.formatMedicalValue(value, options);
      default:
        return this.formatText(value, options);
    }
  }

  /**
   * Date formatting
   */
  formatDate(value, options = {}) {
    if (!value) return '--';

    const date = moment(value);
    if (!date.isValid()) return '--';

    const format = options.format || this.dateFormat;

    // Add relative time for recent dates
    if (options.relative) {
      const daysAgo = moment().diff(date, 'days');
      if (daysAgo === 0) return 'Today';
      if (daysAgo === 1) return 'Yesterday';
      if (daysAgo < 7) return `${daysAgo} days ago`;
    }

    // Highlight overdue dates
    if (options.highlightOverdue && date.isBefore(moment(), 'day')) {
      return {
        text: date.format(format),
        className: 'overdue',
        icon: 'warning'
      };
    }

    return date.format(format);
  }

  /**
   * Time formatting
   */
  formatTime(value, options = {}) {
    if (!value) return '--';

    const time = moment(value);
    if (!time.isValid()) return '--';

    const format = options.format || this.timeFormat;
    return time.format(format);
  }

  /**
   * DateTime formatting
   */
  formatDateTime(value, options = {}) {
    if (!value) return '--';

    const dateTime = moment(value);
    if (!dateTime.isValid()) return '--';

    const dateFormat = options.dateFormat || this.dateFormat;
    const timeFormat = options.timeFormat || this.timeFormat;

    // Show relative time for very recent
    if (options.relative) {
      const minutesAgo = moment().diff(dateTime, 'minutes');
      if (minutesAgo < 1) return 'Just now';
      if (minutesAgo < 60) return `${minutesAgo} min ago`;
      if (minutesAgo < 120) return '1 hour ago';
      if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)} hours ago`;
    }

    return `${dateTime.format(dateFormat)} ${dateTime.format(timeFormat)}`;
  }

  /**
   * Currency formatting
   */
  formatCurrency(value, options = {}) {
    if (value == null) return '--';

    const currency = options.currency || this.currency;

    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Percentage formatting
   */
  formatPercentage(value, options = {}) {
    if (value == null) return '--';

    const decimals = options.decimals !== undefined ? options.decimals : 1;
    const formatted = Number(value).toFixed(decimals);

    // Color code based on thresholds
    if (options.thresholds) {
      const { low, high } = options.thresholds;
      if (value < low) {
        return {
          text: `${formatted}%`,
          className: 'low-value',
          color: 'red'
        };
      }
      if (value > high) {
        return {
          text: `${formatted}%`,
          className: 'high-value',
          color: 'green'
        };
      }
    }

    return `${formatted}%`;
  }

  /**
   * Boolean formatting
   */
  formatBoolean(value, options = {}) {
    const trueText = options.trueText || 'Yes';
    const falseText = options.falseText || 'No';

    if (options.icons) {
      return value ?
        { text: trueText, icon: 'check', color: 'green' } :
        { text: falseText, icon: 'close', color: 'gray' };
    }

    return value ? trueText : falseText;
  }

  /**
   * Number formatting
   */
  formatNumber(value, options = {}) {
    if (value == null) return '--';

    const decimals = options.decimals !== undefined ? options.decimals : 2;
    const formatted = Number(value).toFixed(decimals);

    // Add units if provided
    if (options.unit) {
      return `${formatted} ${options.unit}`;
    }

    // Add thousands separator
    if (options.thousandsSeparator) {
      return Number(formatted).toLocaleString(this.locale);
    }

    return formatted;
  }

  /**
   * Status formatting with badges
   */
  formatStatus(value, options = {}) {
    if (!value) return '--';

    const statusMap = options.statusMap || {
      'scheduled': { color: 'blue', icon: 'schedule' },
      'in-progress': { color: 'orange', icon: 'pending' },
      'completed': { color: 'green', icon: 'check_circle' },
      'cancelled': { color: 'red', icon: 'cancel' },
      'active': { color: 'green', icon: 'check' },
      'inactive': { color: 'gray', icon: 'block' },
      'pending': { color: 'yellow', icon: 'hourglass' },
      'approved': { color: 'green', icon: 'done' },
      'rejected': { color: 'red', icon: 'close' },
      'critical': { color: 'darkred', icon: 'error' },
      'stable': { color: 'green', icon: 'favorite' },
      'urgent': { color: 'orange', icon: 'priority_high' }
    };

    const status = value.toLowerCase().replace(/\s+/g, '-');
    const config = statusMap[status] || { color: 'gray', icon: 'help' };

    return {
      text: value,
      badge: true,
      color: config.color,
      icon: config.icon,
      className: `status-${status}`
    };
  }

  /**
   * Severity formatting (for allergies, conditions, etc.)
   */
  formatSeverity(value, options = {}) {
    if (!value) return '--';

    const severityMap = {
      'mild': { color: '#FFC107', icon: 'info', priority: 1 },
      'moderate': { color: '#FF9800', icon: 'warning', priority: 2 },
      'severe': { color: '#F44336', icon: 'error', priority: 3 },
      'life-threatening': { color: '#B71C1C', icon: 'dangerous', priority: 4 },
      'critical': { color: '#B71C1C', icon: 'dangerous', priority: 4 }
    };

    const severity = value.toLowerCase().replace(/\s+/g, '-');
    const config = severityMap[severity] || { color: '#9E9E9E', icon: 'help', priority: 0 };

    return {
      text: value,
      badge: true,
      color: config.color,
      icon: config.icon,
      priority: config.priority,
      className: `severity-${severity}`
    };
  }

  /**
   * Phone number formatting
   */
  formatPhone(value, options = {}) {
    if (!value) return '--';

    // Remove all non-digits
    const cleaned = value.toString().replace(/\D/g, '');

    // US phone format
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // International format
    if (cleaned.length > 10) {
      return `+${cleaned.slice(0, cleaned.length - 10)} ${this.formatPhone(cleaned.slice(-10))}`;
    }

    return value;
  }

  /**
   * Email formatting
   */
  formatEmail(value, options = {}) {
    if (!value) return '--';

    if (options.mailto) {
      return {
        text: value,
        link: `mailto:${value}`,
        icon: 'email'
      };
    }

    return value.toLowerCase();
  }

  /**
   * Address formatting
   */
  formatAddress(value, options = {}) {
    if (!value) return '--';

    if (typeof value === 'object') {
      const parts = [];
      if (value.street) parts.push(value.street);
      if (value.city) parts.push(value.city);
      if (value.state) parts.push(value.state);
      if (value.zipCode) parts.push(value.zipCode);
      if (value.country && value.country !== 'USA') parts.push(value.country);

      return parts.join(', ');
    }

    return value;
  }

  /**
   * Name formatting
   */
  formatName(value, options = {}) {
    if (!value) return '--';

    if (typeof value === 'object') {
      const parts = [];
      if (value.title) parts.push(value.title);
      if (value.firstName) parts.push(value.firstName);
      if (value.middleName && options.includeMiddle) parts.push(value.middleName);
      if (value.lastName) parts.push(value.lastName);
      if (value.suffix) parts.push(value.suffix);

      return parts.join(' ');
    }

    // Capitalize first letter of each word
    return value.toString()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Medical-specific value formatting
   */
  formatMedicalValue(value, options = {}) {
    const { type, referenceRange, unit } = options;

    switch (type) {
      case 'bloodPressure':
        return this.formatBloodPressure(value);

      case 'labResult':
        return this.formatLabResult(value, referenceRange);

      case 'dosage':
        return this.formatDosage(value, unit);

      case 'frequency':
        return this.formatFrequency(value);

      case 'vitals':
        return this.formatVitals(value);

      case 'bmi':
        return this.formatBMI(value);

      default:
        return value;
    }
  }

  /**
   * Blood pressure formatting
   */
  formatBloodPressure(value) {
    if (!value) return '--';

    if (typeof value === 'object') {
      const { systolic, diastolic } = value;
      const formatted = `${systolic}/${diastolic}`;

      // Check if hypertensive
      if (systolic >= 140 || diastolic >= 90) {
        return {
          text: formatted,
          className: 'hypertensive',
          icon: 'warning',
          color: 'red'
        };
      }

      // Check if hypotensive
      if (systolic < 90 || diastolic < 60) {
        return {
          text: formatted,
          className: 'hypotensive',
          icon: 'warning',
          color: 'orange'
        };
      }

      return formatted;
    }

    return value;
  }

  /**
   * Lab result formatting with flags
   */
  formatLabResult(value, referenceRange) {
    if (value == null) return '--';

    const numValue = parseFloat(value);
    let flag = '';
    let color = 'black';
    let icon = null;

    if (referenceRange) {
      const { min, max, critical_low, critical_high } = referenceRange;

      // Critical values
      if (critical_high && numValue > critical_high) {
        flag = 'CRITICAL HIGH';
        color = 'darkred';
        icon = 'error';
      } else if (critical_low && numValue < critical_low) {
        flag = 'CRITICAL LOW';
        color = 'darkred';
        icon = 'error';
      }
      // Abnormal values
      else if (max && numValue > max) {
        flag = 'H';
        color = 'red';
        icon = 'arrow_upward';
      } else if (min && numValue < min) {
        flag = 'L';
        color = 'red';
        icon = 'arrow_downward';
      }
    }

    return {
      text: value,
      flag,
      color,
      icon,
      referenceRange: referenceRange ? `${referenceRange.min}-${referenceRange.max}` : null
    };
  }

  /**
   * Medication dosage formatting
   */
  formatDosage(value, unit) {
    if (!value) return '--';

    if (typeof value === 'object') {
      const { amount, unit: dosageUnit, form } = value;
      return `${amount} ${dosageUnit || unit} ${form || ''}`.trim();
    }

    return unit ? `${value} ${unit}` : value;
  }

  /**
   * Medication frequency formatting
   */
  formatFrequency(value) {
    if (!value) return '--';

    const frequencyMap = {
      'qd': 'Once daily',
      'bid': 'Twice daily',
      'tid': 'Three times daily',
      'qid': 'Four times daily',
      'prn': 'As needed',
      'qhs': 'At bedtime',
      'qam': 'Every morning',
      'q4h': 'Every 4 hours',
      'q6h': 'Every 6 hours',
      'q8h': 'Every 8 hours',
      'q12h': 'Every 12 hours'
    };

    return frequencyMap[value.toLowerCase()] || value;
  }

  /**
   * Vitals formatting
   */
  formatVitals(value) {
    if (!value) return '--';

    const vitals = [];

    if (value.temperature) {
      const temp = parseFloat(value.temperature);
      const tempText = `${temp}°F`;
      if (temp > 100.4) {
        vitals.push({ text: tempText, color: 'red', label: 'Temp' });
      } else if (temp < 96.8) {
        vitals.push({ text: tempText, color: 'blue', label: 'Temp' });
      } else {
        vitals.push({ text: tempText, label: 'Temp' });
      }
    }

    if (value.heartRate) {
      const hr = parseInt(value.heartRate);
      const hrText = `${hr} bpm`;
      if (hr > 100) {
        vitals.push({ text: hrText, color: 'red', label: 'HR' });
      } else if (hr < 60) {
        vitals.push({ text: hrText, color: 'orange', label: 'HR' });
      } else {
        vitals.push({ text: hrText, label: 'HR' });
      }
    }

    if (value.respiratoryRate) {
      const rr = parseInt(value.respiratoryRate);
      const rrText = `${rr}`;
      if (rr > 20 || rr < 12) {
        vitals.push({ text: rrText, color: 'orange', label: 'RR' });
      } else {
        vitals.push({ text: rrText, label: 'RR' });
      }
    }

    if (value.oxygenSaturation) {
      const o2 = parseInt(value.oxygenSaturation);
      const o2Text = `${o2}%`;
      if (o2 < 95) {
        vitals.push({ text: o2Text, color: 'red', label: 'O2' });
      } else {
        vitals.push({ text: o2Text, label: 'O2' });
      }
    }

    return vitals;
  }

  /**
   * BMI formatting
   */
  formatBMI(value) {
    if (!value) return '--';

    const bmi = parseFloat(value);
    let category = '';
    let color = 'black';

    if (bmi < 18.5) {
      category = 'Underweight';
      color = 'orange';
    } else if (bmi < 25) {
      category = 'Normal';
      color = 'green';
    } else if (bmi < 30) {
      category = 'Overweight';
      color = 'orange';
    } else {
      category = 'Obese';
      color = 'red';
    }

    return {
      text: bmi.toFixed(1),
      category,
      color,
      className: `bmi-${category.toLowerCase()}`
    };
  }

  /**
   * Text formatting (default)
   */
  formatText(value, options = {}) {
    if (!value) return '--';

    const text = value.toString();

    // Truncate if needed
    if (options.maxLength && text.length > options.maxLength) {
      return {
        text: text.substring(0, options.maxLength) + '...',
        fullText: text,
        truncated: true
      };
    }

    // Highlight search terms
    if (options.highlight) {
      const highlighted = text.replace(
        new RegExp(`(${options.highlight})`, 'gi'),
        '<mark>$1</mark>'
      );
      return { html: highlighted };
    }

    return text;
  }

  /**
   * Null/undefined formatting
   */
  formatNull() {
    return '--';
  }

  /**
   * Batch format multiple values
   */
  formatBatch(data, formatRules) {
    const formatted = {};

    for (const [field, rule] of Object.entries(formatRules)) {
      const value = data[field];
      if (typeof rule === 'string') {
        formatted[field] = this.format(value, rule);
      } else {
        formatted[field] = this.format(value, rule.type, rule.options);
      }
    }

    return formatted;
  }

  /**
   * Format entire row for grid
   */
  formatGridRow(row, columns) {
    const formatted = { ...row };

    columns.forEach(column => {
      if (column.formatter) {
        const value = row[column.field];
        formatted[column.field] = this.format(value, column.formatter, column.formatterOptions);
      }
    });

    return formatted;
  }
}

// Export singleton instance
module.exports = new GridDataFormatterService();