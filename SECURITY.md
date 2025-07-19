# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Tab seriously. If you have discovered a security vulnerability in our project, we appreciate your help in disclosing it to us in a responsible manner.

### Reporting Process

1. **DO NOT** create a public GitHub issue for the vulnerability.
2. Email your findings to `security@[yourdomain].com` (please update this with your actual security email).
3. Provide as much information as possible about the vulnerability:
   - Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
   - Full paths of source file(s) related to the manifestation of the issue
   - The location of the affected source code (tag/branch/commit or direct URL)
   - Any special configuration required to reproduce the issue
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit the issue

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will provide an estimated timeline for addressing the vulnerability.
- We will notify you when the vulnerability is fixed.
- We will publicly acknowledge your responsible disclosure, if you wish.

### Security Considerations for Tab

Given that Tab handles payment processing and sensitive customer data, please pay special attention to:

- **API Key Security**: Issues related to API key generation, storage, or validation
- **Payment Data**: Vulnerabilities that could expose payment information or allow unauthorized charges
- **Authentication/Authorization**: Bypasses in authentication or privilege escalation
- **Data Isolation**: Cross-tenant data access or RLS policy bypasses
- **Webhook Security**: Issues with webhook validation or replay attacks
- **PII Exposure**: Leakage of personally identifiable information

## Security Best Practices

When contributing to Tab, please follow these security guidelines:

1. **Never commit secrets**: API keys, passwords, or tokens should never be committed to the repository
2. **Validate all inputs**: Use Zod schemas for validation, especially for API endpoints
3. **Use parameterized queries**: Always use Drizzle ORM's built-in query methods to prevent SQL injection
4. **Implement proper CORS**: Ensure CORS policies are correctly configured for API endpoints
5. **Secure webhooks**: Always validate webhook signatures from Stripe
6. **Follow principle of least privilege**: Ensure RLS policies grant minimal necessary access

## Dependencies

We regularly update dependencies to patch known vulnerabilities. To check for vulnerabilities in dependencies:

```bash
npm audit
```

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Stripe Security Best Practices](https://stripe.com/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)