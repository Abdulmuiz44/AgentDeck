# Windows Service

## Implemented now

Talocode includes a CLI foundation that calls `sc.exe` on Windows:

```powershell
talo service install
talo service start
talo service status
talo service stop
talo service uninstall
```

The service command creates a Windows service named `Talocode` that runs the built CLI daemon (`node dist/cli/index.js start`) with the default host/port unless environment variables are configured for that service account.

## Partial/fallback behavior

- On macOS/Linux, every service command returns `{ supported: false }` with a clear message instead of crashing.
- On Windows, install/uninstall/start/stop may require an elevated Administrator terminal. Talocode returns the `sc.exe` error and an Administrator hint when access is denied.
- This is a service foundation, not a full production installer with recovery policies, signing, or per-user configuration UI.

## Known limitations

- Environment variables for providers must be available to the service process/account.
- There is no automatic service health recovery policy yet.
- The packaged installer is not complete in this MVP.

## Next phase

Add signed installer integration, explicit service environment configuration, health recovery policy, and clearer Windows UI around service state.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
