# Remote Access Security

## Implemented now

AgentDeck remote access is explicit opt-in. By default the daemon remains localhost-only and unauthenticated LAN clients cannot call protected API routes.

Security behavior:

- Pairing and phone access tokens are generated with cryptographic random bytes.
- Tokens are hashed before storage and verified with timing-safe comparison when hashes are the same length.
- Pairing tokens are one-time: a successful pair clears the stored pairing hash. Rotate access to pair another phone.
- Paired phone sessions expire after 30 days and can be revoked immediately.
- Remote clients must send `Authorization: Bearer <accessToken>` for protected APIs.
- Localhost dashboard and CLI retain convenient local access.
- Provider secrets are represented by environment variable names and safe responses do not return raw API keys.
- Logs and error messages pass through redaction helpers for common token/API-key patterns.

## Safe phone APIs

Paired phones can use status, discovery, providers, projects, sessions, logs, stream/input, and basic session start/stop/restart routes.

The remote guard blocks phone clients from:

- provider mutation and default-provider changes
- arbitrary project path registration/update/delete
- integration config writes/previews
- settings reset/export
- arbitrary command execution
- terminal resize in this MVP

## Partial/fallback behavior

- Origin allow-list fields exist in settings but full origin policy enforcement is a future hardening item.
- `/health`, `/api/status`, `/api/remote/access`, and `/api/remote/pair` are intentionally reachable enough to support pairing/status flows.
- LAN access depends on local firewall/router policy.

## Operational guidance

Enable Phone Control only on trusted networks. Disable it when finished on shared LANs. If a phone is lost, revoke that device or disable phone access from the desktop dashboard or CLI.

## Next phase

Add native QR rendering, audit logs, per-device permissions, shorter pairing-token TTLs, origin allow-list enforcement, and optional cloud relay with account-based authorization for off-LAN control.
