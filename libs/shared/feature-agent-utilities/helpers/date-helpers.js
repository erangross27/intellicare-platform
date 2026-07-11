// Date Helper Utilities
// Provides date manipulation utilities for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class DateHelpers {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('date-helpers');
    }

    // Add days to date
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // Add months to date
    addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    // Add years to date
    addYears(date, years) {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return result;
    }

    // Get difference in days between dates
    diffInDays(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Get difference in months between dates
    diffInMonths(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        let months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months += d2.getMonth() - d1.getMonth();
        
        return Math.abs(months);
    }

    // Get difference in years between dates
    diffInYears(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        let years = d2.getFullYear() - d1.getFullYear();
        
        // Adjust if we haven't reached the birthday yet this year
        const monthDiff = d2.getMonth() - d1.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && d2.getDate() < d1.getDate())) {
            years--;
        }
        
        return Math.abs(years);
    }

    // Check if date is in the past
    isPast(date) {
        return new Date(date) < new Date();
    }

    // Check if date is in the future
    isFuture(date) {
        return new Date(date) > new Date();
    }

    // Check if date is today
    isToday(date) {
        const today = new Date();
        const checkDate = new Date(date);
        
        return checkDate.getDate() === today.getDate() &&
               checkDate.getMonth() === today.getMonth() &&
               checkDate.getFullYear() === today.getFullYear();
    }

    // Check if date is weekend
    isWeekend(date) {
        const day = new Date(date).getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    }

    // Get start of day
    startOfDay(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    // Get end of day
    endOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    // Get start of week
    startOfWeek(date) {
        const result = new Date(date);
        const day = result.getDay();
        const diff = result.getDate() - day; // Sunday is 0
        result.setDate(diff);
        return this.startOfDay(result);
    }

    // Get end of week
    endOfWeek(date) {
        const result = new Date(date);
        const day = result.getDay();
        const diff = result.getDate() + (6 - day); // Saturday is 6
        result.setDate(diff);
        return this.endOfDay(result);
    }

    // Get start of month
    startOfMonth(date) {
        const result = new Date(date);
        result.setDate(1);
        return this.startOfDay(result);
    }

    // Get end of month
    endOfMonth(date) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + 1, 0);
        return this.endOfDay(result);
    }

    // Get start of year
    startOfYear(date) {
        const result = new Date(date);
        result.setMonth(0, 1);
        return this.startOfDay(result);
    }

    // Get end of year
    endOfYear(date) {
        const result = new Date(date);
        result.setMonth(11, 31);
        return this.endOfDay(result);
    }

    // Format date as ISO string (YYYY-MM-DD)
    toISODateString(date) {
        return new Date(date).toISOString().split('T')[0];
    }

    // Parse date from various formats
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Try different formats
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
            /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY or DD-MM-YYYY
            /^\d{1,2}\.\d{1,2}\.\d{4}$/ // MM.DD.YYYY or DD.MM.YYYY
        ];
        
        for (const format of formats) {
            if (format.test(dateString)) {
                const parsed = new Date(dateString);
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }
        
        return null;
    }

    // Get date range (array of dates between two dates)
    getDateRange(startDate, endDate, step = 1) {
        const dates = [];
        let current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            dates.push(new Date(current));
            current = this.addDays(current, step);
        }
        
        return dates;
    }

    // Get business days between dates (excluding weekends)
    getBusinessDays(startDate, endDate) {
        let count = 0;
        let current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            if (!this.isWeekend(current)) {
                count++;
            }
            current = this.addDays(current, 1);
        }
        
        return count;
    }

    // Get next business day
    getNextBusinessDay(date) {
        let next = this.addDays(date, 1);
        
        while (this.isWeekend(next)) {
            next = this.addDays(next, 1);
        }
        
        return next;
    }

    // Get previous business day
    getPreviousBusinessDay(date) {
        let prev = this.addDays(date, -1);
        
        while (this.isWeekend(prev)) {
            prev = this.addDays(prev, -1);
        }
        
        return prev;
    }

    // Format relative time
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMs < 0) {
            // Future time
            const absDiffDays = Math.abs(diffDays);
            const absDiffHours = Math.abs(diffHours);
            const absDiffMinutes = Math.abs(diffMinutes);
            
            if (absDiffDays > 0) {
                return `in ${absDiffDays} day${absDiffDays > 1 ? 's' : ''}`;
            } else if (absDiffHours > 0) {
                return `in ${absDiffHours} hour${absDiffHours > 1 ? 's' : ''}`;
            } else if (absDiffMinutes > 0) {
                return `in ${absDiffMinutes} minute${absDiffMinutes > 1 ? 's' : ''}`;
            } else {
                return 'in a moment';
            }
        } else {
            // Past time
            if (diffDays > 0) {
                return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffMinutes > 0) {
                return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            } else {
                return 'just now';
            }
        }
    }
}

// Register with service proxy
const dateHelpersInstance = new DateHelpers();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dateHelpers', () => dateHelpersInstance);
}

module.exports = dateHelpersInstance;