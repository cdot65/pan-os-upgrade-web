#!/bin/sh

# Replace API_URL placeholder in the main.js file
sed -i "s|${API_URL}|$API_URL|g" /usr/share/nginx/html/main*.js
