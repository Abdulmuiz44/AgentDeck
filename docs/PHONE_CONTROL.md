# Phone Control

## Implemented now

Phone Control lets AgentDeck act as an always-on cockpit for sessions running on your desktop. The MVP is local-network only: your phone browser connects directly to the AgentDeck daemon on the same trusted Wi-Fi/Ethernet network.

Implemented behavior:

- Phone access is disabled by default.
- Desktop/CLI must explicitly enable access.
- AgentDeck detects non-loopback LAN IPv4 candidates and can bind to `0.0.0.0` when enabled.
- Enabling or rotating access returns a one-time pairing token and `/phone?pair=...` URL.
- The daemon stores only token hashes, not raw pairing or phone access tokens.
- Paired devices can be listed/revoked locally and expire after 30 days.
- The phone UI can view status, providers, agents, projects, sessions, logs, and can start/stop/restart existing sessions.

## Enable from desktop

1. Start AgentDeck on the desktop.
2. Open the dashboard and go to **Settings → Phone Control**.
3. Click **Enable phone access**.
4. AgentDeck generates a one-time pairing token and a phone URL such as `http://192.168.1.20:3768/phone?pair=...`.
5. Open that URL from the phone or copy the QR payload into a QR-code tool until native QR rendering is added.

CLI equivalents:

```bash
agentdeck remote enable
agentdeck remote status
agentdeck remote qr
```

## Pair from phone

Open `/phone` on the LAN URL. If the URL includes `?pair=TOKEN`, tap **Pair this phone**. Otherwise paste the token from the desktop dashboard or `agentdeck remote enable` output.

After pairing, the phone stores a local browser token for 30 days. Revoking the device invalidates that token immediately.

## Revoke or disable

Use **Settings → Phone Control** to revoke a single device or disable all phone access. CLI equivalents:

```bash
agentdeck remote devices
agentdeck remote revoke <device-id>
agentdeck remote disable
```

## Common issues

- **Phone cannot reach desktop:** confirm both devices are on the same network and use the LAN URL, not `127.0.0.1`.
- **Firewall blocks port:** allow TCP port `3768` for the AgentDeck process in Windows Firewall.
- **Wrong Wi-Fi:** guest networks often block peer-to-peer LAN traffic.
- **Daemon bound to localhost:** enabling phone control stores `bindHost=0.0.0.0`; restart AgentDeck if the listener cannot rebind automatically.
- **Token expired/revoked:** rotate the token on desktop and pair again.

## Partial/fallback behavior

- Native QR image rendering is not implemented yet; AgentDeck displays a QR payload/phone URL.
- Phone clients cannot register arbitrary project paths, mutate providers, reset local data, write integrations, or execute arbitrary commands.
- Phone access is LAN-only; there are no accounts or cloud relay yet.

## Next phase

Add native QR rendering, per-device permissions, audit events, shorter pairing-token TTLs, and optional secure cloud relay/sync.
