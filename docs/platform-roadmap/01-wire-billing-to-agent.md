# Task 01: Wire Billing Service to Agent

## Priority: HIGH
## Category: Phase 1 - Wire Existing Services
## Dependencies: None

## Background

IntelliCare has a full `billingService.js` with charge capture, invoice generation, payment processing, revenue reporting, and payment plans. However, **none of these functions are accessible via the chat agent**. The billing service is loaded in `masterServiceLoader.js` but not wired to `agentServiceV4.js`.

**Important**: This task is for INTERNAL billing management only (tracking charges, creating invoices, recording payments within the system). It does NOT require a business ID, clearinghouse enrollment, or external API connections. No claims will be submitted to insurance companies.

## What Already Exists

### billingService.js
Location: `apps/backend-api/services/billingService.js`
Functions available:
- `captureCharge(patientId, chargeData)` - Record a charge for a service
- `processBatchCharges(charges)` - Batch charge processing
- `generateClaim(chargeId)` - Generate internal claim record
- `getPatientInsurance(patientId)` - Get patient insurance info
- `generateSelfPayInvoice(patientId, charges)` - Create self-pay invoice
- `processPayment(invoiceId, paymentData)` - Record a payment
- `generateRevenueReport(dateRange, filters)` - Revenue reporting
- `processRemittance(remittanceData)` - Payment reconciliation
- `createPaymentPlan(patientId, planData)` - Set up payment plan

### What Agent Already Has (for reference)
- `createInvoice` - Exists in agentServiceV4 but may not be connected to billingService
- `recordPayment` - Exists in agentServiceV4
- `getOutstandingBalances` - Exists in agentServiceV4

## What Needs to Be Done

### Step 1: Add Tool Definitions to aiHelpers.js
Location: `apps/backend-api/services/utils/aiHelpers.js`

Add tool schemas for these new agent tools:
- `captureCharge` - With parameters: patientId, serviceCode (CPT), amount, description, providerId, date
- `getPatientCharges` - Get all charges for a patient
- `generateInvoice` - Generate invoice for patient charges
- `processPayment` - Record payment against invoice
- `getOutstandingBalances` - Get unpaid balances
- `createPaymentPlan` - Set up installment plan
- `getRevenueReport` - Get revenue summary by date range
- `getPaymentHistory` - Get payment history for patient

Follow the existing tool schema pattern:
- Explicit flat parameter names (not nested objects)
- Concrete examples in descriptions
- Negative instructions ("Use this field, NOT...")
- Format specifications (YYYY-MM-DD, etc.)

### Step 2: Add Case Routes in agentServiceV4.js
Location: `apps/backend-api/services/agentServiceV4.js`

Add case statements in the tool routing switch that call `billingService` methods. Make sure billingService is required at the top of the file.

### Step 3: Add Function Group in claudeMedicalFunctionGroups.js
Location: `apps/backend-api/services/claudeMedicalFunctionGroups.js`

Add a "billing" function group with keywords:
- "billing", "charge", "invoice", "payment", "balance", "revenue", "payment plan", "self-pay", "copay", "fee", "cost"

### Step 4: Test via Chat
Test these conversations:
- "Capture a charge for patient X - office visit $150"
- "Generate an invoice for patient X"
- "Record a $50 payment for invoice #123"
- "Show me outstanding balances"
- "Create a payment plan for patient X - $100/month"
- "Show me revenue report for last month"

## Files to Modify
1. `apps/backend-api/services/utils/aiHelpers.js` - Tool definitions
2. `apps/backend-api/services/agentServiceV4.js` - Case routes + require billingService
3. `apps/backend-api/services/claudeMedicalFunctionGroups.js` - Function group

## Status: COMPLETED (February 6, 2026)

### What Was Done
1. Added 8 billing tool schemas in `aiHelpers.js`: captureCharge, getPatientCharges, generateInvoice, processPayment, getOutstandingBalances, createPaymentPlan, getRevenueReport, getPaymentHistory
2. Added getShortDescription entries for all 8 billing tools
3. Replaced existing raw-DB billing case routes in `agentServiceV4.js` with proper `billingService` calls (createInvoice/recordPayment/getOutstandingBalances refactored + 5 new routes added)
4. Added `billingPayments` function group in `claudeMedicalFunctionGroups.js` with 25 keywords
5. Added 8 billing function names to `agentSystemPrompt.js` function list + billing instruction
6. Payment processing remains stubbed (mockProcessingResult) - real payment API will be added after company registration/EIN

## Notes
- The billingService already handles all the business logic
- We're just creating the bridge between chat and the service
- No external API calls needed
- No business ID needed - this is internal record keeping
