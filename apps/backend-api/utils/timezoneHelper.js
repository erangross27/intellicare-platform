/**
 * Multi-Practice Timezone Helper
 * Each practice has its own timezone based on address location
 *
 * CRITICAL DESIGN DECISION:
 * - MongoDB stores LOCAL PRACTICE TIME (for troubleshooting)
 * - Each practice timezone is different (Yale = America/New_York, other = Asia/Jerusalem, etc.)
 * - When you look at MongoDB, you see EXACT local time document was created
 *
 * Documents store 3 timestamp fields:
 * - createdAt: Local practice time (what humans see in database)
 * - createdAtUTC: UTC time (for system operations)
 * - createdAtTimezone: Which timezone was used (e.g., "America/New_York")
 */

/**
 * Get current time in practice's local timezone
 * Converts UTC time to practice local time and returns a Date object with local time values
 *
 * @param {string} timezone - IANA timezone identifier (e.g., "America/New_York", "Asia/Jerusalem")
 * @returns {Object} { localTime: Date, utcTime: Date, timezone: string }
 *
 * Example: If UTC is 10:24:00 and practice timezone is America/New_York (UTC-4):
 * - utcTime: 2025-11-01T10:24:00.000Z (actual UTC)
 * - localTime: Date object where getHours() returns 6 (New York local hour)
 * - When stored in MongoDB, shows as practice local time for troubleshooting
 */
function getPracticeLocalTime(timezone = 'UTC') {
  const now = new Date();

  // Get UTC time
  const utcTime = new Date(now.toISOString());

  // Convert UTC to practice local time and get the components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const dateParts = {};
  parts.forEach(({ type, value }) => {
    dateParts[type] = value;
  });

  // Create a Date object with the practice local time values AS UTC
  // CRITICAL: Use Date.UTC() to treat these values as UTC, not as local server time
  // This ensures MongoDB stores the practice local time correctly
  const localTime = new Date(Date.UTC(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1, // JavaScript months are 0-indexed
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  ));

  return {
    localTime,    // Date with practice local time values (for MongoDB storage)
    utcTime,      // Actual UTC time (for system operations)
    timezone      // IANA timezone identifier
  };
}

/**
 * Get timestamp object for document creation
 *
 * @param {string} timezone - Practice timezone (from practice.settings.timezone)
 * @returns {Object} Timestamp object for MongoDB document
 *
 * @example
 * const timestamps = getTimestampForDocument('America/New_York');
 * // Returns:
 * // {
 * //   createdAt: Date(2025-11-01 14:00:00),  // Local New York time
 * //   createdAtUTC: Date(2025-11-01 19:00:00),  // UTC time
 * //   createdAtTimezone: 'America/New_York',
 * //   updatedAt: Date(2025-11-01 14:00:00),
 * //   updatedAtUTC: Date(2025-11-01 19:00:00),
 * //   updatedAtTimezone: 'America/New_York'
 * // }
 */
function getTimestampForDocument(timezone = 'UTC') {
  const { localTime, utcTime, timezone: tz } = getPracticeLocalTime(timezone);

  return {
    createdAt: localTime,           // Local practice time (for troubleshooting)
    createdAtUTC: utcTime,          // UTC time (for system operations)
    createdAtTimezone: tz,          // Which timezone was used
    updatedAt: localTime,
    updatedAtUTC: utcTime,
    updatedAtTimezone: tz
  };
}

/**
 * Get update timestamp (only updatedAt fields)
 *
 * @param {string} timezone - Practice timezone
 * @returns {Object} Update timestamp object
 */
function getUpdateTimestamp(timezone = 'UTC') {
  const { localTime, utcTime, timezone: tz } = getPracticeLocalTime(timezone);

  return {
    updatedAt: localTime,
    updatedAtUTC: utcTime,
    updatedAtTimezone: tz
  };
}

/**
 * Format date for display in practice timezone
 *
 * @param {Date} date - Date to format
 * @param {string} timezone - Practice timezone
 * @param {string} format - Format style ('full', 'short', 'time', 'date')
 * @returns {string} Formatted date string
 */
function formatDateInTimezone(date, timezone = 'UTC', format = 'full') {
  if (!date) return '';

  const options = {
    timeZone: timezone
  };

  if (format === 'full') {
    options.year = 'numeric';
    options.month = 'long';
    options.day = 'numeric';
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  } else if (format === 'short') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
    options.hour = '2-digit';
    options.minute = '2-digit';
  } else if (format === 'date') {
    options.year = 'numeric';
    options.month = '2-digit';
    options.day = '2-digit';
  } else if (format === 'time') {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return new Date(date).toLocaleString('en-US', options);
}

/**
 * Format timestamp for logs in practice timezone
 * @param {Date} date - Date to format
 * @param {string} timezone - Practice timezone
 * @returns {string} Formatted timestamp [YYYY-MM-DD HH:mm:ss]
 */
function formatLogTimestamp(date = new Date(), timezone = 'UTC') {
  const localDate = new Date(date.toLocaleString('en-US', {
    timeZone: timezone
  }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');

  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
}

// Backward compatibility - keep old Israel-specific functions
function getIsraelTime() {
  return getPracticeLocalTime('Asia/Jerusalem').localTime;
}

function utcToIsrael(utcDate) {
  const date = new Date(utcDate);
  return new Date(date.toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem'
  }));
}

function getIsraelDateString() {
  const israelDate = getIsraelTime();
  const year = israelDate.getFullYear();
  const month = String(israelDate.getMonth() + 1).padStart(2, '0');
  const day = String(israelDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  // New multi-practice functions
  getPracticeLocalTime,
  getTimestampForDocument,
  getUpdateTimestamp,
  formatDateInTimezone,
  formatLogTimestamp,

  // Backward compatibility
  getIsraelTime,
  utcToIsrael,
  getIsraelDateString
};
