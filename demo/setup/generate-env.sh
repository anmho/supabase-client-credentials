#!/bin/bash
# Generate .env file from Supabase status

set -e

STATUS_OUTPUT=$(supabase status --output env 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Could not get values from 'supabase status'"
    echo "Make sure Supabase is running: supabase start"
    exit 1
fi

SUPABASE_URL=$(echo "$STATUS_OUTPUT" | grep "^API_URL=" | cut -d'=' -f2 | tr -d '"')
SECRET_KEY=$(echo "$STATUS_OUTPUT" | grep "^SECRET_KEY=" | cut -d'=' -f2 | tr -d '"')
SERVICE_ROLE_KEY=$(echo "$STATUS_OUTPUT" | grep "^SERVICE_ROLE_KEY=" | cut -d'=' -f2 | tr -d '"')

if [ -z "$SUPABASE_URL" ] || [ -z "$SECRET_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Could not extract required values from Supabase status"
    exit 1
fi

cat > .env << EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SECRET_KEY=$SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF

echo "✅ Generated .env file"
