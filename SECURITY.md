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
| Browser API calls | Exact local Host/Origin checks, JSON content type, body cap; manual/disconnect cancellation | Generation has no waiting deadline; pending requests can hold resources until canceled or the connection fails. Local software can forge Origin. |
| Provider | User-selected HTTP(S) Base URL; credentials/query/fragments rejected; redirects not followed; key excluded from prompts/logging | No destination allowlist: campus/private addresses are intentionally reachable. The chosen endpoint receives the key/text; HTTP is plaintext. The key remains visible to the page/process during the call. |
| Generated content | Typed schema, finite numeric checks, page-range validation, escaped text; no execution of generated code | Prompt injection and factual errors remain possible. Validation is not a correctness guarantee. |
| Browser UI | Content Security Policy, no remote scripts, frame/object restrictions and `nosniff` | CSP is defense in depth, not complete XSS protection. Inline styles are permitted. |
| Files and backups | Size limits, structural/reference validation, atomic IndexedDB replacement transaction | Backups are plaintext. Quotas, storage clearing and multi-window conflicts can cause loss. There is no malware scanner. |

Keys are kept in page memory and individual requests, not localStorage, IndexedDB or exported backups. The application does not intentionally log keys, textbook content or proof files. Activity evidence is not sent to the configured API. Treat any exported backup as confidential if its contents are confidential.

The Base URL is a user-controlled outbound destination, not a fixed-domain proxy. Configure only a service you trust to receive the key and selected text. HTTPS is preferred; HTTP is available for trusted local/campus gateways. The existing origin checks do not constitute a general SSRF defense, and local programs that can forge Origin can direct requests to reachable hosts. No TLS verification bypass is provided. If an endpoint redirects, use its final address rather than forwarding credentials automatically.

Provider requests use Node.js standard-library HTTP(S) with no response deadline/inactivity timeout. Incoming HTTP header/body upload protections remain separate. Manual cancellation or browser disconnection closes the pending upstream connection; this does not guarantee that a provider has stopped processing or billing an already accepted request. There is no automatic retry. Provider/proxy/operating-system failures can still terminate a connection.

PDF parsing uses vendored PDF.js. Dependencies retain their upstream notices and can have their own vulnerabilities. Update reviewed vendor versions deliberately; do not assume the bundled version is always current. Use a maintained Node.js release and browser. Downloaded evidence should be opened with appropriate local software; accepting a file does not establish its safety.

Training checkpoints are intended to be generated locally. The teaching script uses `weights_only=True` when loading its own PyTorch checkpoints, but this is not permission to load arbitrary untrusted files.

## If a credential or private file is exposed

Revoke/rotate the key with the provider immediately; removing it from Git does not invalidate it. Remove the exposed content and coordinate history cleanup if necessary. If private evidence is published, restrict/remove access and assess copies already made. Do not post the secret again while reporting the incident.

## Evidence path picker

Photo-folder writes are restricted to a directory selected through the native dialog and stored in the private profile. The renderer supplies bounded photo bytes/MIME/name, never a destination path; generated names use safe extensions and exclusive creation. Failed owned writes are removed without overwriting existing files. Native raster validation uses the existing pixel/byte limits; SVG fallback is treated as an image. Clipboard IPC reads only an image and is wired to explicit paste controls, without background polling or text access. These operations share sender/frame/origin checks. A compromised trusted renderer could invoke image saves or image-clipboard reads; the bridge is not a separate OS permission boundary. Saved files survive canceled records and are outside JSON-backup byte protection unless an IndexedDB fallback copy exists.

Photo preview/OCR adds sender-checked desktop IPC for absolute image paths or bounded image bytes. Path reads are capped at 20 MiB; native decoding limits output and rejects over 40 million pixels. Preview returns normalized PNG bytes, while OCR returns text from the fixed local Windows helper. SVG fallback uses an image element and local canvas, not inserted markup. Image data is sent over stdin, never interpolated into shell commands. The helper's execution policy is process-local; its output and duration are bounded, and cancellation stops the child. No HTTP image-reading endpoint or model-provider upload is introduced. A compromised trusted renderer could request other supported local images: these operations are not a filesystem permission sandbox. No independent image-codec security audit is claimed. See [behavior and limits](docs/LOCAL_OCR.md).

The optional Electron entry uses a sandboxed, isolated preload with Node integration disabled. Its bridge resolves disk-backed `File` paths, receives explicit transfers, saves a size-limited workspace JSON backup and exports selected activity evidence to a native save-dialog destination. It exposes no generic filesystem, shell or arbitrary IPC interface. Backup saving waits for the actual write; canceling or write failure prevents migration replacement. Main-process IPC validates the sender window, main frame and local root URL. Foreign navigation, popup windows and unneeded permissions are denied; credential-free HTTPS links can open in the system browser. Keep the pinned runtime updated after reviewing security releases.

Explicit evidence export can read absolute paths supplied for at most 1,000 activities/10 references per activity, plus at most 120 MiB of referenced legacy bytes. Only a sender-checked desktop IPC exposes this operation; no HTTP file-read route is added and file bytes are not returned to the renderer. The native dialog chooses the output. Archive names are sanitized, unique and relative; CSV cells are escaped, originals are streamed, and missing files are reported. A temporary output is renamed only after successful completion. Original-file destinations are rejected, and failure removes scratch output. A compromised trusted renderer could supply other local file paths for a user-confirmed export; this is not a filesystem permission sandbox. No evidence is sent to a model provider.

`POST /api/desktop/open` requires exact loopback Host/Origin, JSON and a 257 MiB limit. One transfer is retained only in server memory for up to two minutes. A random 256-bit one-use capability passes in the launched process environment, not command arguments, URLs or logs; `/api/desktop/handoff` consumes it through a header. API keys are outside workspace backups and transfers. Local software with process access is outside this protection boundary. Source browser data remains; replacing existing desktop data requires confirmation and a downloaded backup. `.desktop-user-data/` contains private plaintext browser storage and must never be published.

`POST /api/evidence/pick` requires the exact loopback Host/Origin, JSON with no custom arguments and a 1 KiB body cap. Only one Windows picker is allowed at a time; disconnection aborts its child process. A fixed Windows Forms script is invoked with `execFile`, without shell-interpolating caller data. It returns only explicitly selected full paths and does not read, copy or execute the files. Unsupported platforms use manual path entry. Stored/imported references are inert text and are never automatically opened; `C:\fakepath`, relative paths and control characters are rejected. Existing legacy blob copies are retained until explicitly removed. Removing a reference/activity does not delete the original external file. Path-only backups do not protect the originals from deletion or movement.
