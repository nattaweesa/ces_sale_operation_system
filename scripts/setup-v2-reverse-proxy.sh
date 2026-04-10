#!/usr/bin/env bash
set -euo pipefail

# Setup Nginx reverse proxy + Let's Encrypt for V2 on VPS
# Usage:
#   ./scripts/setup-v2-reverse-proxy.sh --web v2.example.com --api api-v2.example.com --email admin@example.com

VPS_USER="root"
VPS_HOST="187.77.156.215"
WEB_DOMAIN=""
API_DOMAIN=""
LETSENCRYPT_EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web)
      WEB_DOMAIN="$2"
      shift 2
      ;;
    --api)
      API_DOMAIN="$2"
      shift 2
      ;;
    --email)
      LETSENCRYPT_EMAIL="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$WEB_DOMAIN" || -z "$API_DOMAIN" || -z "$LETSENCRYPT_EMAIL" ]]; then
  echo "Usage: $0 --web v2.example.com --api api-v2.example.com --email admin@example.com"
  exit 1
fi

ssh "$VPS_USER@$VPS_HOST" "bash -s" <<EOF
set -euo pipefail

WEB_DOMAIN="$WEB_DOMAIN"
API_DOMAIN="$API_DOMAIN"
LETSENCRYPT_EMAIL="$LETSENCRYPT_EMAIL"
NGINX_CONF_PATH="/etc/nginx/sites-available/ces_sale_operation_v2"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

cat > "\$NGINX_CONF_PATH" <<NGINXCONF
server {
    listen 80;
    server_name \$WEB_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:5175;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name \$API_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8100;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXCONF

ln -sf "\$NGINX_CONF_PATH" /etc/nginx/sites-enabled/ces_sale_operation_v2
nginx -t
systemctl reload nginx

certbot --nginx -d "\$WEB_DOMAIN" -d "\$API_DOMAIN" --agree-tos --email "\$LETSENCRYPT_EMAIL" --redirect --non-interactive

systemctl reload nginx

echo "V2 reverse proxy is ready"
echo "Web: https://\$WEB_DOMAIN"
echo "API: https://\$API_DOMAIN"
EOF
