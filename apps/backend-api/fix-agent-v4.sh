#!/bin/bash

# Fix agentServiceV4.js SecureDataAccess calls

# Fix standard query/update/delete/insert calls that end with context)
sed -i 's/await SecureDataAccess\.query(\([^)]*\), context)/await SecureDataAccess.query(\1, context, this.serviceToken?.apiKey || this.serviceToken)/g' services/agentServiceV4.js

sed -i 's/await SecureDataAccess\.update(\([^)]*\), context)/await SecureDataAccess.update(\1, context, this.serviceToken?.apiKey || this.serviceToken)/g' services/agentServiceV4.js

sed -i 's/await SecureDataAccess\.delete(\([^)]*\), context)/await SecureDataAccess.delete(\1, context, this.serviceToken?.apiKey || this.serviceToken)/g' services/agentServiceV4.js

sed -i 's/await SecureDataAccess\.insert(\([^)]*\), context)/await SecureDataAccess.insert(\1, context, this.serviceToken?.apiKey || this.serviceToken)/g' services/agentServiceV4.js

# Fix incorrect findOne calls with 'securedataaccesss'
sed -i "s/await SecureDataAccess\.findOne('securedataaccesss', '\([^']*\)', \([^,]*\), {}, context, {}, context)/await SecureDataAccess.findOne('\1', \2, {}, context, this.serviceToken?.apiKey || this.serviceToken)/g" services/agentServiceV4.js

# Fix incorrect clinicContext.models.SecureDataAccess.findOne
sed -i "s/await clinicContext\.models\.SecureDataAccess\.findOne('securedataaccesss', '\([^']*\)', \([^,]*\), {}, context, {}, context)/await SecureDataAccess.findOne('\1', \2, {}, context, this.serviceToken?.apiKey || this.serviceToken)/g" services/agentServiceV4.js

echo "Fixed agentServiceV4.js"