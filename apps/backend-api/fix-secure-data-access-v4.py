#!/usr/bin/env python3
import re

def fix_secure_data_access(file_path):
    """Fix SecureDataAccess calls to add apiKey parameter"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match SecureDataAccess calls without apiKey
    # This pattern matches calls that have a context parameter but no apiKey after it
    patterns = [
        # Pattern for calls with context as last parameter (no apiKey)
        (r'(await SecureDataAccess\.(query|update|delete|create|insert|findOne|bulkWrite|aggregate)\([^)]+,\s*context)\)', 
         r'\1, this.serviceToken?.apiKey || this.serviceToken)'),
        
        # Pattern for calls with incorrect findOne syntax
        (r'await SecureDataAccess\.findOne\([\'"]securedataaccesss[\'"]\s*,\s*[\'"](\w+)[\'"]\s*,\s*([^,]+),\s*\{\},\s*context,\s*\{\},\s*context\)',
         r'await SecureDataAccess.findOne(\'\1\', \2, {}, context, this.serviceToken?.apiKey || this.serviceToken)'),
         
        # Pattern for incorrect clinicContext.models.SecureDataAccess.findOne
        (r'await clinicContext\.models\.SecureDataAccess\.findOne\([\'"]securedataaccesss[\'"]\s*,\s*[\'"](\w+)[\'"]\s*,\s*([^,]+),\s*\{\},\s*context,\s*\{\},\s*context\)',
         r'await SecureDataAccess.findOne(\'\1\', \2, {}, context, this.serviceToken?.apiKey || this.serviceToken)'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    # Write the fixed content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed SecureDataAccess calls in {file_path}")

if __name__ == "__main__":
    fix_secure_data_access("services/agentServiceV4.js")