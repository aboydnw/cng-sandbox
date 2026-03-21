#!/bin/bash
# Updates DuckDNS record with current public IP.
# Hardcode values here — cron has no access to .env.
# Run via: crontab -e
#   */5 * * * * /path/to/update-duckdns.sh >> /var/log/duckdns.log 2>&1

SUBDOMAIN="CHANGE_ME"
TOKEN="CHANGE_ME"

echo "$(date): $(curl -s "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=")"
