// Financial Data Validation Utilities
// Provides financial and billing validation for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class FinancialValidators {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('financial-validators');
    }

    // Validate currency amount
    validateCurrencyAmount(amount) {
        if (amount === null || amount === undefined) {
            throw new Error('Amount is required');
        }
        
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            throw new Error('Amount must be a valid number');
        }
        
        if (numAmount < 0) {
            throw new Error('Amount cannot be negative');
        }
        
        if (numAmount > 1000000) {
            throw new Error('Amount cannot exceed 1,000,000');
        }
        
        // Check for reasonable decimal places (max 2 for currency)
        const decimals = (amount.toString().split('.')[1] || '').length;
        if (decimals > 2) {
            throw new Error('Amount cannot have more than 2 decimal places');
        }
        
        return true;
    }

    // Validate currency code
    validateCurrencyCode(currencyCode) {
        if (!currencyCode) {
            throw new Error('Currency code is required');
        }
        
        const validCurrencies = [
            'USD', 'EUR', 'ILS', 'GBP', 'JPY', 'CAD', 'AUD', 
            'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD'
        ];
        
        if (!validCurrencies.includes(currencyCode.toUpperCase())) {
            throw new Error(`Invalid currency code. Must be one of: ${validCurrencies.join(', ')}`);
        }
        
        return true;
    }

    // Validate insurance policy number
    validateInsurancePolicyNumber(policyNumber) {
        if (!policyNumber) {
            throw new Error('Insurance policy number is required');
        }
        
        if (typeof policyNumber !== 'string') {
            throw new Error('Policy number must be a string');
        }
        
        // Remove spaces and dashes for validation
        const cleanPolicy = policyNumber.replace(/[\s-]/g, '');
        
        if (cleanPolicy.length < 5 || cleanPolicy.length > 20) {
            throw new Error('Policy number must be between 5 and 20 characters');
        }
        
        if (!/^[A-Za-z0-9]+$/.test(cleanPolicy)) {
            throw new Error('Policy number can only contain letters and numbers');
        }
        
        return true;
    }

    // Validate billing code (CPT, ICD, etc.)
    validateBillingCode(code, codeType) {
        if (!code) {
            throw new Error('Billing code is required');
        }
        
        switch (codeType?.toLowerCase()) {
            case 'cpt':
                return this.validateCPTCode(code);
            case 'icd10':
            case 'icd-10':
                return this.validateICD10Code(code);
            case 'hcpcs':
                return this.validateHCPCSCode(code);
            default:
                // Generic validation
                if (code.length < 3 || code.length > 10) {
                    throw new Error('Billing code must be between 3 and 10 characters');
                }
                return true;
        }
    }

    // Validate CPT code
    validateCPTCode(code) {
        if (!code) {
            throw new Error('CPT code is required');
        }
        
        // CPT codes are 5 digits, sometimes with modifiers
        const cptRegex = /^\d{5}(-\d{2})?$/;
        if (!cptRegex.test(code)) {
            throw new Error('CPT code must be 5 digits, optionally followed by -XX modifier');
        }
        
        return true;
    }

    // Validate ICD-10 code
    validateICD10Code(code) {
        if (!code) {
            throw new Error('ICD-10 code is required');
        }
        
        // ICD-10 format: Letter followed by 2 digits, optionally followed by decimal and up to 4 characters
        const icd10Regex = /^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$/;
        if (!icd10Regex.test(code)) {
            throw new Error('Invalid ICD-10 code format');
        }
        
        return true;
    }

    // Validate HCPCS code
    validateHCPCSCode(code) {
        if (!code) {
            throw new Error('HCPCS code is required');
        }
        
        // HCPCS Level II codes: Letter followed by 4 digits
        const hcpcsRegex = /^[A-Z]\d{4}$/;
        if (!hcpcsRegex.test(code)) {
            throw new Error('HCPCS code must be one letter followed by 4 digits');
        }
        
        return true;
    }

    // Validate copay amount
    validateCopayAmount(copay) {
        if (copay === null || copay === undefined) {
            return true; // Copay is optional
        }
        
        const numCopay = parseFloat(copay);
        if (isNaN(numCopay)) {
            throw new Error('Copay must be a valid number');
        }
        
        if (numCopay < 0) {
            throw new Error('Copay cannot be negative');
        }
        
        if (numCopay > 1000) {
            throw new Error('Copay amount seems unreasonably high (max 1000)');
        }
        
        return true;
    }

    // Validate deductible amount
    validateDeductibleAmount(deductible) {
        if (deductible === null || deductible === undefined) {
            return true; // Deductible is optional
        }
        
        const numDeductible = parseFloat(deductible);
        if (isNaN(numDeductible)) {
            throw new Error('Deductible must be a valid number');
        }
        
        if (numDeductible < 0) {
            throw new Error('Deductible cannot be negative');
        }
        
        if (numDeductible > 50000) {
            throw new Error('Deductible amount seems unreasonably high (max 50,000)');
        }
        
        return true;
    }

    // Validate payment method
    validatePaymentMethod(paymentMethod) {
        if (!paymentMethod) {
            throw new Error('Payment method is required');
        }
        
        const validMethods = [
            'cash', 'credit_card', 'debit_card', 'check', 
            'insurance', 'bank_transfer', 'paypal', 'other'
        ];
        
        if (!validMethods.includes(paymentMethod.toLowerCase())) {
            throw new Error(`Invalid payment method. Must be one of: ${validMethods.join(', ')}`);
        }
        
        return true;
    }

    // Validate credit card number (basic Luhn algorithm)
    validateCreditCardNumber(cardNumber) {
        if (!cardNumber) {
            throw new Error('Credit card number is required');
        }
        
        // Remove spaces and dashes
        const cleanNumber = cardNumber.replace(/[\s-]/g, '');
        
        // Check if it's all digits
        if (!/^\d+$/.test(cleanNumber)) {
            throw new Error('Credit card number can only contain digits');
        }
        
        // Check length (13-19 digits for most cards)
        if (cleanNumber.length < 13 || cleanNumber.length > 19) {
            throw new Error('Credit card number must be between 13 and 19 digits');
        }
        
        // Luhn algorithm validation
        return this.validateLuhnAlgorithm(cleanNumber);
    }

    // Luhn algorithm for credit card validation
    validateLuhnAlgorithm(cardNumber) {
        let sum = 0;
        let alternate = false;
        
        // Process digits from right to left
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let n = parseInt(cardNumber.charAt(i));
            
            if (alternate) {
                n *= 2;
                if (n > 9) {
                    n = (n % 10) + 1;
                }
            }
            
            sum += n;
            alternate = !alternate;
        }
        
        if (sum % 10 !== 0) {
            throw new Error('Invalid credit card number (failed Luhn check)');
        }
        
        return true;
    }

    // Validate invoice number
    validateInvoiceNumber(invoiceNumber) {
        if (!invoiceNumber) {
            throw new Error('Invoice number is required');
        }
        
        if (typeof invoiceNumber !== 'string') {
            throw new Error('Invoice number must be a string');
        }
        
        if (invoiceNumber.length < 3 || invoiceNumber.length > 20) {
            throw new Error('Invoice number must be between 3 and 20 characters');
        }
        
        // Allow letters, numbers, and basic punctuation
        if (!/^[A-Za-z0-9\-_]+$/.test(invoiceNumber)) {
            throw new Error('Invoice number can only contain letters, numbers, hyphens, and underscores');
        }
        
        return true;
    }
}

// Create and export singleton
const financialValidators = new FinancialValidators();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('financialValidators', () => financialValidators);
}

module.exports = financialValidators;