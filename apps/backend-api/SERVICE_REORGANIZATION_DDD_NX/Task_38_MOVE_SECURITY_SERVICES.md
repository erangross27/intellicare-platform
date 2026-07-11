# Task 38: Move Security Services (CRITICAL)

## Objective
Move 25 security-related services to compliance-security context

## Prerequisites
- Task_37 completed (clinical services moved)
- Security context structure ready
- Zero-downtime requirement understood

## Implementation Steps

### 1. Critical Security Services (25)
```
FROM: backend/services/
TO: libs/compliance-security/

CRITICAL - Move First:
- authenticationService.js → feature-authentication/
- authorizationService.js → feature-authorization/
- serviceAccountManager.js → feature-service-accounts/
- encryptionService.js → feature-encryption/
- kmsService.js → feature-kms/

Session Management:
- sessionManagementService.js → feature-sessions/
- tokenService.js → feature-tokens/
- refreshTokenService.js → feature-tokens/

Access Control:
- rbacService.js → feature-access-control/
- permissionService.js → feature-access-control/
- accessControlService.js → feature-access-control/

Security Monitoring:
- securityAuditService.js → feature-audit/
- intrusionDetectionService.js → feature-monitoring/
- securityEventService.js → feature-monitoring/
- threatDetectionService.js → feature-monitoring/

Compliance:
- hipaaComplianceService.js → feature-compliance/
- gdprService.js → feature-compliance/
- auditLogService.js → feature-audit/

Data Protection:
- dataClassificationService.js → feature-data-protection/
- dlpService.js → feature-data-protection/
- backupEncryptionService.js → feature-data-protection/

Identity Management:
- mfaService.js → feature-authentication/
- ssoService.js → feature-authentication/
- passwordPolicyService.js → feature-authentication/
- identityVerificationService.js → feature-authentication/
```

### 2. Maintain Zero Downtime
CRITICAL - Services must stay online:
- Use dual-run strategy
- Gradual traffic migration
- Session preservation
- Instant rollback ready

### 3. Preserve Authentication Flow
Ensure no user impact:
- Sessions continue working
- Tokens remain valid
- MFA uninterrupted
- SSO functional

### 4. Update All Security References
Update everywhere that uses security:
- Every service
- All routes
- All middleware
- All models

### 5. Test Security Thoroughly
Comprehensive security testing:
- Authentication works
- Authorization enforced
- Encryption functional
- Audit logging active

### 6. Verify HIPAA Compliance
Ensure compliance maintained:
- PHI encryption
- Access controls
- Audit trails
- Consent management

### 7. Security Monitoring Active
Keep monitoring during migration:
- Real-time alerts
- Intrusion detection
- Threat monitoring
- Incident response

### 8. Rollback Plan Ready
Instant rollback if issues:
- < 1 minute rollback
- Session preservation
- No data loss
- User transparent

### 9. Security Team Approval
Get sign-off before proceeding:
- Security audit complete
- Penetration test passed
- Compliance verified
- Risk assessment done

### 10. Document Security Changes
Complete documentation:
- Architecture changes
- New endpoints
- Updated flows
- Emergency procedures

## Expected Outcomes
- ✅ 25 security services migrated
- ✅ Zero downtime achieved
- ✅ Authentication uninterrupted
- ✅ Compliance maintained
- ✅ Security enhanced

## Validation Steps
1. All auth flows work
2. No session interruption
3. Security tests pass
4. Compliance verified
5. Monitoring active

## Rollback Plan
- INSTANT rollback capability
- Traffic redirect in 30 seconds
- Session preservation guaranteed
- Zero data loss

## Time Estimate
- Implementation: 8 hours
- Testing: 6 hours
- Validation: 4 hours
- Documentation: 2 hours

## Dependencies
- Task_37 (clinical services)
- Dual-run authentication ready

## Next Task
Task_39_MOVE_MEDICAL_RECORDS_SERVICES.md

## Notes for Agent
- **MOST CRITICAL TASK**
- **ZERO tolerance for errors**
- **Test everything 3 times**
- **Have rollback ready**
- **Security team must approve**