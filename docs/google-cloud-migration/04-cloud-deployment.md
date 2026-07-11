# Phase 4: Cloud Deployment

## Overview
Deploy containerized IntelliCare application to Google Cloud Run with load balancing and CDN.

## Prerequisites
- Containers built and pushed to Artifact Registry
- MongoDB Atlas cluster running
- Secrets configured in Secret Manager
- Domain name configured (optional)

## Tasks Breakdown

### Task 4.1: Backend Deployment to Cloud Run (45 minutes)
**Objective**: Deploy Node.js backend service to Cloud Run

**Deployment Command**:
```bash
# Deploy backend service
gcloud run deploy intellicare-backend \
  --image=us-central1-docker.pkg.dev/intellicare-production/intellicare-repo/backend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=900 \
  --concurrency=80 \
  --service-account=intellicare-service@intellicare-production.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production,PORT=8080,GOOGLE_CLOUD_PROJECT=intellicare-production" \
  --set-secrets="MONGODB_URI=mongodb-uri:latest,JWT_SECRET=jwt-secret:latest,GEMINI_API_KEY=gemini-api-key:latest"
```

**Service Configuration**:
```yaml
# backend-service.yaml (alternative YAML deployment)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: intellicare-backend
  namespace: default
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1"
    spec:
      serviceAccountName: intellicare-service@intellicare-production.iam.gserviceaccount.com
      containerConcurrency: 80
      timeoutSeconds: 900
      containers:
      - image: us-central1-docker.pkg.dev/intellicare-production/intellicare-repo/backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: GOOGLE_CLOUD_PROJECT
          value: "intellicare-production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-uri
              key: latest
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: latest
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: gemini-api-key
              key: latest
        resources:
          limits:
            memory: "1Gi"
            cpu: "1"
```

**Verify Deployment**:
```bash
# Get service URL
BACKEND_URL=$(gcloud run services describe intellicare-backend --region=us-central1 --format="value(status.url)")
echo "Backend URL: $BACKEND_URL"

# Test health endpoint
curl $BACKEND_URL/health

# Test API endpoint
curl $BACKEND_URL/api/translations
```

### Task 4.2: Frontend Deployment to Cloud Run (40 minutes)
**Objective**: Deploy React frontend service to Cloud Run

**Update Frontend Environment**:
```bash
# Update frontend build with backend URL
cd frontend
echo "REACT_APP_API_URL=$BACKEND_URL" > .env.production
npm run build

# Rebuild container with updated environment
docker build -t us-central1-docker.pkg.dev/intellicare-production/intellicare-repo/frontend:latest .
docker push us-central1-docker.pkg.dev/intellicare-production/intellicare-repo/frontend:latest
```

**Deploy Frontend**:
```bash
# Deploy frontend service
gcloud run deploy intellicare-frontend \
  --image=us-central1-docker.pkg.dev/intellicare-production/intellicare-repo/frontend:latest \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=80 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=5 \
  --timeout=300 \
  --concurrency=100 \
  --set-env-vars="REACT_APP_API_URL=$BACKEND_URL"
```

**Verify Frontend**:
```bash
# Get frontend URL
FRONTEND_URL=$(gcloud run services describe intellicare-frontend --region=us-central1 --format="value(status.url)")
echo "Frontend URL: $FRONTEND_URL"

# Test frontend
curl $FRONTEND_URL/health
```

### Task 4.3: Load Balancer Setup (50 minutes)
**Objective**: Configure load balancer for custom domain and SSL

**Create Load Balancer**:
```bash
# Reserve static IP
gcloud compute addresses create intellicare-ip --global

# Get reserved IP
STATIC_IP=$(gcloud compute addresses describe intellicare-ip --global --format="value(address)")
echo "Static IP: $STATIC_IP"

# Create backend services
gcloud compute backend-services create intellicare-backend-service \
  --global \
  --load-balancing-scheme=EXTERNAL \
  --protocol=HTTP

gcloud compute backend-services create intellicare-frontend-service \
  --global \
  --load-balancing-scheme=EXTERNAL \
  --protocol=HTTP
```

**Add Cloud Run Backends**:
```bash
# Add backend service
gcloud compute backend-services add-backend intellicare-backend-service \
  --global \
  --network-endpoint-group=intellicare-backend-neg \
  --network-endpoint-group-region=us-central1

# Add frontend service  
gcloud compute backend-services add-backend intellicare-frontend-service \
  --global \
  --network-endpoint-group=intellicare-frontend-neg \
  --network-endpoint-group-region=us-central1
```

**Create URL Map**:
```bash
# Create URL map for routing
gcloud compute url-maps create intellicare-url-map \
  --default-service=intellicare-frontend-service

# Add backend path
gcloud compute url-maps add-path-matcher intellicare-url-map \
  --path-matcher-name=api-matcher \
  --default-service=intellicare-frontend-service \
  --backend-service-path-rules="/api/*=intellicare-backend-service"
```

**SSL Certificate**:
```bash
# Create managed SSL certificate (requires domain)
gcloud compute ssl-certificates create intellicare-ssl-cert \
  --domains=intellicare.example.com \
  --global

# Create HTTPS proxy
gcloud compute target-https-proxies create intellicare-https-proxy \
  --url-map=intellicare-url-map \
  --ssl-certificates=intellicare-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create intellicare-https-rule \
  --global \
  --target-https-proxy=intellicare-https-proxy \
  --address=intellicare-ip \
  --ports=443
```

### Task 4.4: Cloud CDN Configuration (30 minutes)
**Objective**: Enable CDN for static assets and improved performance

**Enable CDN**:
```bash
# Enable CDN on frontend backend service
gcloud compute backend-services update intellicare-frontend-service \
  --global \
  --enable-cdn \
  --cache-mode=CACHE_ALL_STATIC \
  --default-ttl=3600 \
  --max-ttl=86400 \
  --client-ttl=3600

# Configure cache key policy
gcloud compute backend-services update intellicare-frontend-service \
  --global \
  --cache-key-include-protocol \
  --cache-key-include-host \
  --cache-key-include-query-string=false
```

**CDN Cache Rules**:
```bash
# Create cache policy for static assets
cat > cdn-policy.yaml << EOF
name: intellicare-cache-policy
defaultTtl: 3600s
maxTtl: 86400s
clientTtl: 3600s
cacheKeyPolicy:
  includeHost: true
  includeProtocol: true
  includeQueryString: false
  queryStringWhitelist: []
negativeCaching: true
negativeCachingPolicy:
- code: 404
  ttl: 300s
- code: 410
  ttl: 300s
EOF

gcloud compute backend-services update intellicare-frontend-service \
  --global \
  --cache-key-policy-file=cdn-policy.yaml
```

### Task 4.5: Health Checks and Monitoring (35 minutes)
**Objective**: Configure health checks and monitoring

**Health Check Configuration**:
```bash
# Create health check for backend
gcloud compute health-checks create http intellicare-backend-health \
  --port=8080 \
  --request-path=/health \
  --check-interval=30s \
  --timeout=10s \
  --healthy-threshold=2 \
  --unhealthy-threshold=3

# Create health check for frontend
gcloud compute health-checks create http intellicare-frontend-health \
  --port=80 \
  --request-path=/health \
  --check-interval=30s \
  --timeout=10s \
  --healthy-threshold=2 \
  --unhealthy-threshold=3

# Update backend services with health checks
gcloud compute backend-services update intellicare-backend-service \
  --global \
  --health-checks=intellicare-backend-health

gcloud compute backend-services update intellicare-frontend-service \
  --global \
  --health-checks=intellicare-frontend-health
```

**Monitoring Setup**:
```bash
# Create uptime check
gcloud alpha monitoring uptime create intellicare-uptime \
  --display-name="IntelliCare Uptime Check" \
  --http-check-path="/health" \
  --hostname="intellicare.example.com" \
  --port=443 \
  --use-ssl \
  --period=60s \
  --timeout=10s
```

### Task 4.6: Security Configuration (40 minutes)
**Objective**: Configure security policies and access controls

**Cloud Armor Security Policy**:
```bash
# Create security policy
gcloud compute security-policies create intellicare-security-policy \
  --description="Security policy for IntelliCare"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy=intellicare-security-policy \
  --expression="true" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=100 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=600 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP

# Add geo-blocking (optional)
gcloud compute security-policies rules create 2000 \
  --security-policy=intellicare-security-policy \
  --expression="origin.region_code == 'CN' || origin.region_code == 'RU'" \
  --action=deny-403 \
  --description="Block traffic from certain regions"

# Apply security policy to backend service
gcloud compute backend-services update intellicare-frontend-service \
  --global \
  --security-policy=intellicare-security-policy
```

**IAM and Access Control**:
```bash
# Restrict Cloud Run access (if needed)
gcloud run services add-iam-policy-binding intellicare-backend \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"

# Create custom role for application access
gcloud iam roles create intellicareAppRole \
  --project=intellicare-production \
  --title="IntelliCare Application Role" \
  --description="Custom role for IntelliCare application" \
  --permissions="storage.objects.create,storage.objects.delete,storage.objects.get,storage.objects.list,secretmanager.versions.access"
```

## Validation Checklist

- [ ] Backend deployed to Cloud Run successfully
- [ ] Frontend deployed to Cloud Run successfully  
- [ ] Load balancer configured with SSL
- [ ] CDN enabled and caching properly
- [ ] Health checks passing
- [ ] Monitoring and alerting configured
- [ ] Security policies applied
- [ ] Custom domain configured (if applicable)
- [ ] End-to-end testing completed

## Performance Targets

### Service Metrics
- **Backend response time**: < 500ms
- **Frontend load time**: < 2 seconds
- **CDN cache hit ratio**: > 80%
- **Uptime**: 99.9%
- **Concurrent users**: 100+

### Scaling Configuration
- **Backend**: 1-10 instances, 80 concurrent requests per instance
- **Frontend**: 1-5 instances, 100 concurrent requests per instance
- **Auto-scaling**: Based on CPU and request count

## Next Steps
Proceed to Phase 5: CI/CD Setup

## Troubleshooting

### Common Issues
1. **Service not accessible**: Check IAM permissions and firewall rules
2. **SSL certificate issues**: Verify domain ownership and DNS configuration
3. **Health check failures**: Check endpoint availability and response format
4. **CDN not caching**: Review cache policies and headers

### Debugging Commands
```bash
# Check service status
gcloud run services describe intellicare-backend --region=us-central1

# View logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=intellicare-backend" --limit=50

# Test connectivity
curl -v https://intellicare.example.com/health
```
