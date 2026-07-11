// Currency Formatting Utilities
// Provides currency formatting for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class CurrencyFormatters {
    constructor() {
        this.serviceToken = null;
        this.exchangeRates = new Map(); // Cache for exchange rates
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('currency-formatters');
    }

    // Format currency amount with symbol
    formatCurrency(amount, currencyCode = 'USD', decimals = 2) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0.00';
        }
        
        const numAmount = parseFloat(amount);
        const symbols = {
            'USD': '$',
            'EUR': '€',
            'ILS': '₪',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$',
            'CHF': 'CHF',
            'CNY': '¥',
            'SEK': 'kr',
            'NZD': 'NZ$',
            'MXN': '$',
            'SGD': 'S$',
            'HKD': 'HK$'
        };
        
        const symbol = symbols[currencyCode.toUpperCase()] || currencyCode;
        const formatted = numAmount.toFixed(decimals);
        
        return `${symbol}${formatted}`;
    }

    // Format currency for display (locale-aware)
    formatCurrencyLocale(amount, currencyCode = 'USD', locale = 'en-US') {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0.00';
        }
        
        const numAmount = parseFloat(amount);
        
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode.toUpperCase()
            }).format(numAmount);
        } catch (error) {
            // Fallback to basic formatting
            return this.formatCurrency(amount, currencyCode);
        }
    }

    // Format price with currency symbol
    formatPrice(price, currencyCode = 'USD', includeCents = true) {
        if (price === null || price === undefined || isNaN(price)) {
            return this.formatCurrency(0, currencyCode, includeCents ? 2 : 0);
        }
        
        return this.formatCurrency(price, currencyCode, includeCents ? 2 : 0);
    }

    // Format cost with detailed breakdown
    formatCostBreakdown(costData, currencyCode = 'USD') {
        if (!costData || typeof costData !== 'object') {
            return null;
        }
        
        const breakdown = {};
        
        if (costData.subtotal !== undefined) {
            breakdown.subtotal = this.formatCurrency(costData.subtotal, currencyCode);
        }
        
        if (costData.tax !== undefined) {
            breakdown.tax = this.formatCurrency(costData.tax, currencyCode);
        }
        
        if (costData.discount !== undefined) {
            breakdown.discount = this.formatCurrency(costData.discount, currencyCode);
        }
        
        if (costData.total !== undefined) {
            breakdown.total = this.formatCurrency(costData.total, currencyCode);
        }
        
        return breakdown;
    }

    // Format insurance copay
    formatCopay(amount, currencyCode = 'USD') {
        if (!amount || amount === 0) {
            return 'No copay';
        }
        
        return `Copay: ${this.formatCurrency(amount, currencyCode)}`;
    }

    // Format deductible amount
    formatDeductible(amount, currencyCode = 'USD') {
        if (!amount || amount === 0) {
            return 'No deductible';
        }
        
        return `Deductible: ${this.formatCurrency(amount, currencyCode)}`;
    }

    // Format payment amount
    formatPayment(amount, currencyCode = 'USD', paymentMethod = null) {
        const formattedAmount = this.formatCurrency(amount, currencyCode);
        
        if (paymentMethod) {
            const methodNames = {
                'cash': 'Cash',
                'credit_card': 'Credit Card',
                'debit_card': 'Debit Card',
                'check': 'Check',
                'insurance': 'Insurance',
                'bank_transfer': 'Bank Transfer',
                'paypal': 'PayPal',
                'other': 'Other'
            };
            
            const method = methodNames[paymentMethod.toLowerCase()] || paymentMethod;
            return `${formattedAmount} (${method})`;
        }
        
        return formattedAmount;
    }

    // Format billing amount with status
    formatBillingAmount(amount, status, currencyCode = 'USD') {
        const formattedAmount = this.formatCurrency(amount, currencyCode);
        
        const statusLabels = {
            'pending': 'Pending',
            'paid': 'Paid',
            'overdue': 'Overdue',
            'cancelled': 'Cancelled',
            'refunded': 'Refunded',
            'partial': 'Partially Paid'
        };
        
        const statusLabel = statusLabels[status?.toLowerCase()] || status;
        
        if (statusLabel) {
            return `${formattedAmount} (${statusLabel})`;
        }
        
        return formattedAmount;
    }

    // Format currency conversion
    formatCurrencyConversion(amount, fromCurrency, toCurrency, exchangeRate) {
        const originalAmount = this.formatCurrency(amount, fromCurrency);
        const convertedAmount = this.formatCurrency(amount * exchangeRate, toCurrency);
        
        return {
            original: originalAmount,
            converted: convertedAmount,
            rate: exchangeRate,
            display: `${originalAmount} = ${convertedAmount}`
        };
    }

    // Format percentage for financial calculations
    formatPercentage(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '0.00%';
        }
        
        const numValue = parseFloat(value);
        return `${numValue.toFixed(decimals)}%`;
    }

    // Format interest rate
    formatInterestRate(rate, period = 'annual') {
        const formattedRate = this.formatPercentage(rate);
        
        const periodLabels = {
            'annual': 'APR',
            'monthly': 'per month',
            'daily': 'per day',
            'yearly': 'per year'
        };
        
        const periodLabel = periodLabels[period.toLowerCase()] || period;
        return `${formattedRate} ${periodLabel}`;
    }

    // Format large numbers (e.g., 1K, 1M)
    formatLargeNumber(amount, currencyCode = null) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0';
        }
        
        const numAmount = Math.abs(parseFloat(amount));
        const symbol = currencyCode ? this.getCurrencySymbol(currencyCode) : '';
        const sign = amount < 0 ? '-' : '';
        
        if (numAmount >= 1e9) {
            return `${sign}${symbol}${(numAmount / 1e9).toFixed(1)}B`;
        } else if (numAmount >= 1e6) {
            return `${sign}${symbol}${(numAmount / 1e6).toFixed(1)}M`;
        } else if (numAmount >= 1e3) {
            return `${sign}${symbol}${(numAmount / 1e3).toFixed(1)}K`;
        } else {
            return currencyCode ? this.formatCurrency(amount, currencyCode) : amount.toString();
        }
    }

    // Get currency symbol
    getCurrencySymbol(currencyCode) {
        const symbols = {
            'USD': '$',
            'EUR': '€',
            'ILS': '₪',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$',
            'CHF': 'CHF',
            'CNY': '¥',
            'SEK': 'kr',
            'NZD': 'NZ$',
            'MXN': '$',
            'SGD': 'S$',
            'HKD': 'HK$'
        };
        
        return symbols[currencyCode?.toUpperCase()] || currencyCode || '';
    }

    // Parse currency string to number
    parseCurrencyString(currencyString) {
        if (!currencyString || typeof currencyString !== 'string') {
            return 0;
        }
        
        // Remove currency symbols and spaces
        const cleaned = currencyString.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        
        return isNaN(parsed) ? 0 : parsed;
    }

    // Format currency range
    formatCurrencyRange(minAmount, maxAmount, currencyCode = 'USD') {
        const min = this.formatCurrency(minAmount, currencyCode);
        const max = this.formatCurrency(maxAmount, currencyCode);
        
        return `${min} - ${max}`;
    }

    // Format invoice total
    formatInvoiceTotal(invoiceData, currencyCode = 'USD') {
        if (!invoiceData || typeof invoiceData !== 'object') {
            return this.formatCurrency(0, currencyCode);
        }
        
        const subtotal = parseFloat(invoiceData.subtotal) || 0;
        const tax = parseFloat(invoiceData.tax) || 0;
        const discount = parseFloat(invoiceData.discount) || 0;
        const total = subtotal + tax - discount;
        
        return {
            subtotal: this.formatCurrency(subtotal, currencyCode),
            tax: this.formatCurrency(tax, currencyCode),
            discount: this.formatCurrency(discount, currencyCode),
            total: this.formatCurrency(total, currencyCode)
        };
    }
}

// Register with service proxy
const currencyFormattersInstance = new CurrencyFormatters();

if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('currencyFormatters', () => currencyFormattersInstance);
}

module.exports = currencyFormattersInstance;