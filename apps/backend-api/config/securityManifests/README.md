# Service Security Manifests

This directory contains security manifests for all background services in the IntelliCare platform.

## What is a Service Manifest?

A service manifest defines:
- **Permissions**: What operations the service can perform
- **Practice Access**: Which practices the service can access (* for all)
- **Data Access Patterns**: Expected database queries
- **Schedules**: When the service runs
- **Criticality**: How important the service is (critical/high/medium/low)
- **MFA Requirement**: Whether the service requires MFA for sensitive operations

## Adding a New Service

1. Create a manifest file: `{service-id}.manifest.json`
2. Define required permissions (be minimal!)
3. Specify allowed practices (restrict if possible)
4. Document data access patterns
5. Set appropriate criticality level

## Security Guidelines

- **Principle of Least Privilege**: Only grant permissions the service actually needs
- **Practice Isolation**: Restrict to specific practices unless global access is required
- **Audit Everything**: All service operations are logged automatically
- **Token Rotation**: Service tokens rotate every 24 hours automatically

## Manifest Structure

```json
{
  "serviceId": "unique-service-id",
  "serviceName": "Human Readable Name",
  "description": "What this service does",
  "permissions": ["permission:action"],
  "allowedClinics": ["*"] or ["clinic1", "clinic2"],
  "dataAccessPatterns": ["Example queries"],
  "schedules": [{"cron": "pattern", "description": "When it runs"}],
  "criticality": "critical|high|medium|low",
  "requiresMFA": true|false
}
```

## Current Services

- **Data Retention Service** (`data-retention-service`): Handles automated data cleanup, archival, and compliance with retention policies
- **File Cleanup Service** (`file-cleanup-service`): Handles automatic cleanup of temporary files, orphaned uploads, and old logs
- **Security Monitoring Service** (`security-monitoring-service`): Real-time security monitoring and threat detection
- **Backup Service** (`backup-service`): Automated database and file backups
- **Email Service** (`email-service`): Handles email notifications and communications
- **Report Generator Service** (`report-generator`): Generates medical reports and documents
- **Compliance Reporting Service** (`compliance-reporting-service`): Generates HIPAA and GDPR compliance reports
- **Threat Detection Service** (`threat-detection-service`): Advanced threat detection and response
- **AI Response Cache Service** (`ai-response-cache-service`): Caches AI responses for performance optimization
- **Audit Log Service** (`audit-log-service`): Manages audit logs and compliance tracking

## Monitoring

Service authentication and operations are monitored through:
- Real-time security dashboard: `/api/security-monitoring/dashboard`
- Audit logs: `backend/logs/security-audit.log`
- Immutable audit trail: MongoDB `audit_logs` collection

Generated: 2025-08-22T14:04:17.119Z
