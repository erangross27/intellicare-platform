# Phase 2: Containerization Guide

## Overview
Create Docker containers for both frontend and backend components of IntelliCare.

## Prerequisites
- Docker installed and running
- Artifact Registry configured
- Project structure analyzed

## Tasks Breakdown

### Task 2.1: Backend Containerization (60 minutes)
**Objective**: Create production-ready Docker container for Node.js backend

**Create Backend Dockerfile**:
```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS base

# Install system dependencies for medical document processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    tesseract-ocr \
    tesseract-ocr-data-heb \
    tesseract-ocr-data-eng \
    ghostscript \
    imagemagick \
    poppler-utils

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start application
CMD ["npm", "start"]
```

**Create .dockerignore**:
```
# backend/.dockerignore
node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
Dockerfile
.dockerignore
uploads/*
tests
*.test.js
coverage
.nyc_output
```

**Build and Test**:
```bash
cd backend
docker build -t intellicare-backend .
docker run -p 8080:8080 intellicare-backend
```

### Task 2.2: Frontend Containerization (45 minutes)
**Objective**: Create optimized Docker container for React frontend

**Create Frontend Dockerfile**:
```dockerfile
# frontend/Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/build /usr/share/nginx/html

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Create nginx.conf**:
```nginx
# frontend/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy to backend
        location /api/ {
            proxy_pass http://intellicare-backend:8080/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

**Create .dockerignore**:
```
# frontend/.dockerignore
node_modules
npm-debug.log
.env
.env.local
.git
.gitignore
README.md
Dockerfile
.dockerignore
build
coverage
.nyc_output
src/**/*.test.js
src/**/*.spec.js
```

### Task 2.3: Environment Configuration (30 minutes)
**Objective**: Configure environment variables for containers

**Backend Environment Variables**:
```bash
# backend/.env.production
NODE_ENV=production
PORT=8080
MONGODB_URI=${MONGODB_URI}
JWT_SECRET=${JWT_SECRET}
GEMINI_API_KEY=${GEMINI_API_KEY}
GOOGLE_CLOUD_PROJECT=intellicare-production
GOOGLE_CLOUD_STORAGE_BUCKET=intellicare-documents
```

**Frontend Environment Variables**:
```bash
# frontend/.env.production
REACT_APP_API_URL=https://intellicare-backend-url
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
```

**Update Backend for Cloud Storage**:
```javascript
// backend/config/storage.js
const { Storage } = require('@google-cloud/storage');

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);

module.exports = { storage, bucket };
```

### Task 2.4: Docker Compose for Local Testing (20 minutes)
**Objective**: Create docker-compose for local container testing

**Create docker-compose.yml**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/intellicare
      - JWT_SECRET=local-jwt-secret
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - mongo
    volumes:
      - ./backend/uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8080
    depends_on:
      - backend

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=intellicare

volumes:
  mongo_data:
```

**Test Local Containers**:
```bash
# Build and run containers
docker-compose up --build

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:3000/health
```

### Task 2.5: Multi-Architecture Build (25 minutes)
**Objective**: Build containers for multiple architectures

**Create Build Scripts**:
```bash
#!/bin/bash
# scripts/build-containers.sh

set -e

PROJECT_ID="intellicare-production"
REGION="us-central1"
REPOSITORY="intellicare-repo"

# Build backend
echo "Building backend container..."
cd backend
docker build --platform linux/amd64 -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/backend:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/backend:latest

# Build frontend
echo "Building frontend container..."
cd ../frontend
docker build --platform linux/amd64 -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/frontend:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/frontend:latest

echo "Containers built and pushed successfully!"
```

**Make script executable**:
```bash
chmod +x scripts/build-containers.sh
```

### Task 2.6: Container Optimization (40 minutes)
**Objective**: Optimize containers for production

**Backend Optimizations**:
1. Use Alpine Linux base image
2. Multi-stage build for smaller image
3. Remove development dependencies
4. Optimize layer caching
5. Add security scanning

**Frontend Optimizations**:
1. Multi-stage build with nginx
2. Gzip compression
3. Static asset optimization
4. Security headers
5. Caching strategies

**Security Scanning**:
```bash
# Scan containers for vulnerabilities
docker scout cves intellicare-backend:latest
docker scout cves intellicare-frontend:latest
```

**Image Size Optimization**:
```bash
# Check image sizes
docker images | grep intellicare

# Target sizes:
# Backend: < 500MB
# Frontend: < 100MB
```

## Validation Checklist

- [ ] Backend Dockerfile created and tested
- [ ] Frontend Dockerfile created and tested
- [ ] Environment variables configured
- [ ] Docker compose working locally
- [ ] Multi-architecture builds successful
- [ ] Container optimization completed
- [ ] Security scanning passed
- [ ] Images pushed to Artifact Registry

## Performance Targets

### Container Metrics
- **Backend startup time**: < 30 seconds
- **Frontend startup time**: < 10 seconds
- **Backend image size**: < 500MB
- **Frontend image size**: < 100MB
- **Memory usage**: Backend < 512MB, Frontend < 128MB

### Health Checks
- **Backend health endpoint**: `/health`
- **Frontend health endpoint**: `/health`
- **Response time**: < 1 second
- **Uptime requirement**: 99.9%

## Next Steps
Proceed to Phase 3: Database Migration

## Troubleshooting

### Common Issues
1. **Build failures**: Check Dockerfile syntax and dependencies
2. **Large image sizes**: Optimize layers and remove unnecessary files
3. **Startup failures**: Verify environment variables and dependencies
4. **Health check failures**: Ensure endpoints are accessible

### Debugging Commands
```bash
# Check container logs
docker logs <container_id>

# Execute shell in container
docker exec -it <container_id> /bin/sh

# Inspect container
docker inspect <container_id>
```
