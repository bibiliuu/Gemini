#!/bin/bash

# 1. Install Nginx
echo "Installing Nginx..."
apt-get update
apt-get install -y nginx

# 2. Create Nginx Configuration
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/gemini-app <<EOF
server {
    listen 80;
    server_name _;  # Listen on all domains/IPs

    location / {
        client_max_body_size 50M;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 3. Enable Configuration
rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/gemini-app /etc/nginx/sites-enabled/

# 4. Restart Nginx
echo "Restarting Nginx..."
systemctl restart nginx

echo "✅ Nginx setup complete! You can now access the app at http://YOUR_SERVER_IP"
