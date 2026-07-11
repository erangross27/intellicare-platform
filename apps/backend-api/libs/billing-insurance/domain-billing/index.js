// Billing Domain Models
// Core billing entities: Invoice, Payment, InsuranceClaim, Coverage, FinancialAccount

module.exports = {
  Invoice: require('./Invoice'),
  Payment: require('./Payment'),
  InsuranceClaim: require('./InsuranceClaim'), 
  Coverage: require('./Coverage'),
  FinancialAccount: require('./FinancialAccount')
};