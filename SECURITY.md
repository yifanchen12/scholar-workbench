# Security policy

[简体中文](SECURITY.zh-CN.md) · [Privacy and data flow](docs/PRIVACY.md)

## Supported scope

Security fixes are developed for the latest `2.x` code on `main`. Historical `1.x` interfaces and independently modified forks are not supported. This is a volunteer educational project with best-effort maintenance, no response-time guarantee and no bounty program. No formal independent security audit has been completed.

The supported deployment is a single user running the Node.js server on their own machine at `127.0.0.1`. Public hosting, reverse proxies, LAN binding and shared-user installations are outside this security model. The application does not provide accounts, access control or an encrypted data vault.

## Report a vulnerability privately

Use GitHub's [private vulnerability reporting form](https://github.com/yifanchen12/scholar-workbench/security/advisories/new). Do not disclose exploitable details in a public issue or pull request. If that form is unavailable, open a minimal issue asking for a private reporting channel, without the exploit, key or personal files; wait for a private route before sending details.

Include:

- The affected commit/version, operating system, Node.js and browser versions.
- A clear description of the affected boundary and impact.
- Reproduction steps using synthetic PDFs, test records and a placeholder API key.
- Minimal proof of concept, expected/actual behavior and any suggested mitigation.

Never attach real API credentials, student evidence, private backups, copyrighted textbook copies or unrelated system data. Do not test against other people's installations or incur paid provider calls without the account owner's authorization. Stop once the issue is demonstrated without accessing additional data.

Maintainers aim to acknowledge and reproduce a report, discuss a correction privately, and coordinate a patch and advisory when appropriate. Severity and disclosure timing are decided case by case. Please keep exploit details private while a fix is coordinated; this does not promise a particular response deadline.

## Implemented controls and limits

| Boundary | Control | Residual limitation |
| --- | --- | --- |
| Local HTTP service | Binds to IPv4 loopback; static path allowlist; GET/HEAD for static files; restricted API route | No authentication; other local programs can contact it. |
| Browser API calls | Exact local Host/Origin checks, JSON content type, body cap and timeout | Local non-browser software can forge Origin. This does not protect against a compromised host or malicious browser extension. |
| Provider | User-selected HTTP(S) Base URL; credentials/query/fragments rejected; redirects not followed; key excluded from prompts/logging | No destination allowlist: campus/private addresses are intentionally reachable. The chosen endpoint receives the key/text; HTTP is plaintext. The key remains visible to the page/process during the call. |
| Generated content | Typed schema, finite numeric checks, page-range validation, escaped text; no execution of generated code | Prompt injection and factual errors remain possible. Validation is not a correctness guarantee. |
| Browser UI | Content Security Policy, no remote scripts, frame/object restrictions and `nosniff` | CSP is defense in depth, not complete XSS protection. Inline styles are permitted. |
| Files and backups | Size limits, structural/reference validation, atomic IndexedDB replacement transaction | Backups are plaintext. Quotas, storage clearing and multi-window conflicts can cause loss. There is no malware scanner. |

Keys are kept in page memory and individual requests, not localStorage, IndexedDB or exported backups. The application does not intentionally log keys, textbook content or proof files. Activity evidence is not sent to the configured API. Treat any exported backup as confidential if its contents are confidential.

The Base URL is a user-controlled outbound destination, not a fixed-domain proxy. Configure only a service you trust to receive the key and selected text. HTTPS is preferred; HTTP is available for trusted local/campus gateways. The existing origin checks do not constitute a general SSRF defense, and local programs that can forge Origin can direct requests to reachable hosts. No TLS verification bypass is provided. If an endpoint redirects, use its final address rather than forwarding credentials automatically.

PDF parsing uses vendored PDF.js. Dependencies retain their upstream notices and can have their own vulnerabilities. Update reviewed vendor versions deliberately; do not assume the bundled version is always current. Use a maintained Node.js release and browser. Downloaded evidence should be opened with appropriate local software; accepting a file does not establish its safety.

Training checkpoints are intended to be generated locally. The teaching script uses `weights_only=True` when loading its own PyTorch checkpoints, but this is not permission to load arbitrary untrusted files.

## If a credential or private file is exposed

Revoke/rotate the key with the provider immediately; removing it from Git does not invalidate it. Remove the exposed content and coordinate history cleanup if necessary. If private evidence is published, restrict/remove access and assess copies already made. Do not post the secret again while reporting the incident.
