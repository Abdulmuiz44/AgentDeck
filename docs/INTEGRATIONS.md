# Integrations

Talocode integrates with tools through adapter metadata, PATH discovery, and generated OpenAI-compatible config snippets.

## Supported adapters

- Codex CLI
- Codex App
- Claude Code
- OpenCode
- Gemini CLI
- Ollama Runtime

Discovery checks command availability with `where` on Windows and `which` on macOS/Linux, then runs the adapter's version command where possible. Discovery returns detected/not detected status, executable path, version, and documentation URL.

## Ollama Local

Default OpenAI-compatible base URL:

```text
http://localhost:11434/v1
```

Ollama is treated as a local provider/runtime. Talocode does not store raw secrets; it can pass an environment variable name such as `OLLAMA_API_KEY` to tools that require one.

## OpenRouter

Default OpenAI-compatible base URL:

```text
https://openrouter.ai/api/v1
```

Recommended environment variable:

```text
OPENROUTER_API_KEY
```

## Custom OpenAI-compatible providers

Custom providers can be registered with a name, base URL, default model, and API key environment variable reference. Talocode stores the environment variable name, not the value.

## Codex config generation

`POST /api/integrations/codex/configure` returns a TOML snippet that defines an Talocode model provider and profile. Dry run is default.

## OpenCode config generation

`POST /api/integrations/opencode/configure` returns a JSON snippet using an environment-variable API key reference. Dry run is default.

## Safe writes

When `dryRun` is `false`, Talocode:

1. Creates parent directories if needed.
2. Backs up an existing config to `*.talocode-backup-<timestamp>`.
3. Writes the generated config.
4. Records the integration action in local persistence.

Raw API keys are never written by Talocode; only environment variable references are used.

## Preview and write endpoints

New generic integration endpoints:

- `POST /api/integrations/config/preview`
- `POST /api/integrations/config/write`

Request fields include `targetTool`, `providerId`, `model`, optional `baseUrl`, optional `apiKeyEnvVar`, and optional `targetConfigPath`. Preview is dry-run only; write creates a backup first when a file already exists.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
