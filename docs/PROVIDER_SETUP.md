# Provider Setup

## Implemented now

Talocode stores provider metadata and API key **environment variable names** only. It never stores raw API key values.

Implemented provider behavior:

- Ollama local provider and model refresh through the local tags endpoint.
- OpenRouter/custom OpenAI-compatible `/models` checks when the configured API key environment variable is available to the daemon.
- OpenAI-compatible config generation for Codex/OpenCode with dry-run and backup writes.
- OpenAI, Anthropic, and Gemini records are present, but Anthropic/Gemini native routing remains placeholder-level.

## Ollama Local

Default base URL:

```text
http://localhost:11434/v1
```

Ollama does not require an API key by default. To test it:

1. Start Ollama locally.
2. Run `talo providers test ollama`.
3. Talocode calls the local Ollama tags endpoint and caches discovered model names when available.

## OpenRouter

Default base URL:

```text
https://openrouter.ai/api/v1
```

Set the API key in the daemon environment before starting Talocode:

```powershell
$env:OPENROUTER_API_KEY = "..."
node dist/cli/index.js start
```

Then run:

```bash
talo providers add --type openrouter --name OpenRouter --apiKeyEnvVar OPENROUTER_API_KEY --model openai/gpt-4o-mini
talo providers test openrouter
```

## Custom OpenAI-Compatible

Provide a name, base URL, API key environment variable, and default model:

```bash
talo providers add --type openai-compatible --name LocalGateway --baseUrl http://localhost:8000/v1 --apiKeyEnvVar CUSTOM_OPENAI_API_KEY --model my-model
```

## Model refresh

Provider models can be refreshed from the dashboard Providers page or CLI:

```bash
talo providers models ollama
talo providers refresh-models ollama
talo providers refresh-models openrouter
```

## Phone safety

Phone clients can view redacted provider metadata and refresh model lists where allowed, but cannot add/update/delete providers or write raw secrets.

## Known limitations

- Native Anthropic/Gemini provider execution is not implemented yet.
- Service-mode provider API keys must be set for the Windows service account/environment.
- Provider compatibility recommendations are future work.

## Migration from AgentDeck

Talocode started as the AgentDeck prototype. The project has moved to the Talocode brand and repository at https://github.com/talocode/talocode.
