#!/bin/bash

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit
fi

echo "🔐 Setting up SSL (HTTPS) for muse-jia.club..."

# 1. Install Certbot and Nginx plugin
echo "📦 Installing Certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

# 2. Run Certbot (Non-interactive)
echo "🚀 Requesting Certificate..."
certbot --nginx -d muse-jia.club --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "✅ SSL Setup Complete!"
echo "Your site should now be accessible at https://muse-jia.club"
