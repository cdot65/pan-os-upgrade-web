#!/bin/sh

# Replace API_URL placeholder in all JavaScript files
find /usr/share/nginx/html -name '*.js' -exec sed -i "s|API_URL_PLACEHOLDER|$API_URL|g" {} +

# Replace BACKEND_PORT placeholder in all JavaScript files
find /usr/share/nginx/html -name '*.js' -exec sed -i "s|BACKEND_PORT_PLACEHOLDER|$BACKEND_PORT|g" {} +

# Output for debugging
echo "API_URL has been set to: $API_URL"
echo "BACKEND_PORT has been set to: $BACKEND_PORT"
