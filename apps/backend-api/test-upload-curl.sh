#!/bin/bash

# Create a simple PDF file
echo "%PDF-1.4" > test.pdf

# Test document upload with curl
curl -X POST http://localhost:5000/api/documents/upload-secure \
  -H "x-auth-token: <AUTH_TOKEN>" \
  -H "x-clinic-subdomain: hipaa-test-english" \
  -F "file=@test.pdf" \
  -F "documentType=medical_record" \
  -F "patientName=Test Patient"

# Clean up
rm test.pdf