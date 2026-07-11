// Date Formatting Utilities
// Provides date and time formatting for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class DateFormatters {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('date-formatters');
    }

    // Format date for display (intelligently handles various input formats)
    formatDate(dateStr, language = 'en') {
        if (!dateStr) return dateStr;
        
        // Already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }
        
        // Try to parse the date intelligently
        let date;
        
        // Handle various formats
        if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}$/.test(dateStr)) {
            // DD/MM/YYYY or MM/DD/YYYY format
            const parts = dateStr.split(/[\/\.\-]/);
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            
            // Intelligent detection: if first number > 12, it's definitely day
            if (day > 12) {
                // DD/MM/YYYY format
                date = new Date(year, month - 1, day);
            } else if (month > 12) {
                // MM/DD/YYYY format (month and day swapped)
                date = new Date(year, day - 1, month);
            } else {
                // Ambiguous - use language preference
                if (language === 'he' || language === 'IL') {
                    // Israeli format: DD/MM/YYYY
                    date = new Date(year, month - 1, day);
                } else {
                    // US format: MM/DD/YYYY
                    date = new Date(year, day - 1, month);
                }
            }
        } else if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2}$/.test(dateStr)) {
            // Short year format (DD/MM/YY or MM/DD/YY)
            const parts = dateStr.split(/[\/\.\-]/);
            const year = 2000 + parseInt(parts[2]); // Assume 20xx
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            
            if (language === 'he' || language === 'IL') {
                date = new Date(year, month - 1, day);
            } else {
                date = new Date(year, day - 1, month);
            }
        } else {
            // Try native Date parsing (handles "August 15, 1990", etc.)
            date = new Date(dateStr);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            // If parsing failed, return original string
            return dateStr;
        }
        
        // Format as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    // Format date for display in locale-specific format
    formatDateForDisplay(dateStr, language = 'en') {
        if (!dateStr) return dateStr;
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        const locale = language === 'he' ? 'he-IL' : 'en-US';
        return date.toLocaleDateString(locale);
    }

    // Format datetime for display
    formatDateTime(dateTimeStr, language = 'en') {
        if (!dateTimeStr) return dateTimeStr;
        
        const date = new Date(dateTimeStr);
        if (isNaN(date.getTime())) return dateTimeStr;
        
        const locale = language === 'he' ? 'he-IL' : 'en-US';
        return date.toLocaleString(locale);
    }

    // Format time only
    formatTime(timeStr) {
        if (!timeStr) return timeStr;
        
        // If it's already in HH:MM format
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
            return timeStr;
        }
        
        // Try to parse as full date and extract time
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        
        return timeStr;
    }

    // Format age from birth date
    formatAge(birthDate) {
        if (!birthDate) return null;
        
        const birth = new Date(birthDate);
        if (isNaN(birth.getTime())) return null;
        
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    // Format duration in minutes to human readable
    formatDuration(minutes) {
        if (!minutes || minutes < 0) return '0 minutes';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours === 0) {
            return `${mins} minute${mins !== 1 ? 's' : ''}`;
        } else if (mins === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else {
            return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
        }
    }

    // Format relative time (e.g., "2 hours ago", "in 3 days")
    formatRelativeTime(dateStr, language = 'en') {
        if (!dateStr) return dateStr;
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        const isHebrew = language === 'he';
        
        if (diffMs < 0) {
            // Future time
            const absDiffMins = Math.abs(diffMins);
            const absDiffHours = Math.abs(diffHours);
            const absDiffDays = Math.abs(diffDays);
            
            if (absDiffDays > 0) {
                return isHebrew ? `בעוד ${absDiffDays} ימים` : `in ${absDiffDays} day${absDiffDays > 1 ? 's' : ''}`;
            } else if (absDiffHours > 0) {
                return isHebrew ? `בעוד ${absDiffHours} שעות` : `in ${absDiffHours} hour${absDiffHours > 1 ? 's' : ''}`;
            } else if (absDiffMins > 0) {
                return isHebrew ? `בעוד ${absDiffMins} דקות` : `in ${absDiffMins} minute${absDiffMins > 1 ? 's' : ''}`;
            } else {
                return isHebrew ? 'בעוד רגע' : 'in a moment';
            }
        } else {
            // Past time
            if (diffDays > 0) {
                return isHebrew ? `לפני ${diffDays} ימים` : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                return isHebrew ? `לפני ${diffHours} שעות` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffMins > 0) {
                return isHebrew ? `לפני ${diffMins} דקות` : `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            } else {
                return isHebrew ? 'הרגע' : 'just now';
            }
        }
    }

    // Format date range
    formatDateRange(startDate, endDate, language = 'en') {
        if (!startDate || !endDate) return '';
        
        const start = this.formatDateForDisplay(startDate, language);
        const end = this.formatDateForDisplay(endDate, language);
        
        const isHebrew = language === 'he';
        return isHebrew ? `${start} עד ${end}` : `${start} - ${end}`;
    }

    // Format appointment time slot
    formatAppointmentSlot(date, startTime, duration) {
        const dateFormatted = this.formatDateForDisplay(date);
        const startFormatted = this.formatTime(startTime);
        
        if (duration) {
            const durationFormatted = this.formatDuration(duration);
            return `${dateFormatted} ${startFormatted} (${durationFormatted})`;
        }
        
        return `${dateFormatted} ${startFormatted}`;
    }

    // Format ISO date to local format
    formatISOToLocal(isoDateStr, language = 'en') {
        if (!isoDateStr) return isoDateStr;
        
        const date = new Date(isoDateStr);
        if (isNaN(date.getTime())) return isoDateStr;
        
        const locale = language === 'he' ? 'he-IL' : 'en-US';
        return date.toLocaleString(locale);
    }

    // Format birthdate with age
    formatBirthDateWithAge(birthDate, language = 'en') {
        if (!birthDate) return '';
        
        const dateFormatted = this.formatDateForDisplay(birthDate, language);
        const age = this.formatAge(birthDate);
        
        const isHebrew = language === 'he';
        return isHebrew 
            ? `${dateFormatted} (גיל ${age})`
            : `${dateFormatted} (age ${age})`;
    }

    // Format medical date (for medical records)
    formatMedicalDate(dateStr, includeTime = false) {
        if (!dateStr) return dateStr;
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        if (includeTime) {
            return date.toISOString().slice(0, 16).replace('T', ' ');
        } else {
            return date.toISOString().slice(0, 10);
        }
    }

    // Convert timezone
    formatDateInTimezone(dateStr, timezone) {
        if (!dateStr) return dateStr;
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        try {
            return date.toLocaleString('en-US', { timeZone: timezone });
        } catch (error) {
            console.error('Invalid timezone:', timezone);
            return dateStr;
        }
    }
}

// Register with service proxy
const dateFormattersInstance = new DateFormatters();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dateFormatters', () => dateFormattersInstance);
}

module.exports = dateFormattersInstance;