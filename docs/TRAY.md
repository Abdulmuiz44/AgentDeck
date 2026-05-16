# System Tray

## Implemented now

The Electron app creates a tray menu when the platform/runtime supports it. Actions include:

- Open Talocode
- Start daemon
- Stop daemon
- Restart daemon
- Open logs folder
- Open data folder
- Quit

The tray uses an empty icon fallback so a missing packaged icon does not crash startup.

## Partial/fallback behavior

- If tray creation fails, Talocode logs a warning and continues running the window/daemon.
- Menu state refreshes after menu actions; it does not continuously poll daemon health yet.
- If a CLI daemon is already using the port, Electron logs the daemon startup failure and still opens the desktop window.

## Known limitations

- No final packaged tray icon yet.
- No service-aware tray status or recovery controls yet.
- Quit stops the Electron-managed daemon; it does not stop an unrelated daemon started in another terminal.

## Next phase

Add packaged icon assets, live health polling, service integration, and clearer duplicate-daemon messaging.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
