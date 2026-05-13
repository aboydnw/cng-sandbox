# Security Policy

## Supported Versions

Only the latest release is actively supported.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **anthony.n.boyd@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You should receive a response within 5 business days. Once confirmed, a fix will be prioritized and a CVE/advisory filed if warranted.

## Scope

This project includes an `/api/proxy` endpoint that fetches remote geospatial files on behalf of users. If you find a way to use it to reach internal network resources (SSRF), bypass authentication, or exfiltrate data, please report it privately.
