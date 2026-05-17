# Context Caching

Talocode-level context caching reduces repeated token costs by identifying stable project files, hashing their content, and tracking when they change. This is **not** provider-native prompt caching yet — it operates at the Talocode orchestration layer, before any agent gets invoked.

## What Talocode-level caching means

When you run an AI coding agent, a large portion of the input context is project metadata — files like `AGENTS.md`, `package.json`, `ARCHITECTURE.md`, and documentation. These files rarely change between agent runs. Talocode's context caching:

1. **Identifies** stable project files
2. **Hashes** their content into a deterministic manifest
3. **Packs** them into a reusable "context pack"
4. **Tracks** whether files have changed since the pack was built
5. **Estimates** how many tokens could be saved by reusing cached content

This gives you visibility into your project's context stability and helps plan for provider-native caching later.

## What it does NOT do yet

- It does **not** call any provider's prompt caching API (Anthropic Prompt Caching, Google Context Caching, etc.)
- It does **not** inject cached context directly into LLM calls
- It does **not** modify agent commands or provider requests

These capabilities are designed to be added later, on top of this foundation.

## How context packs work

### Stable file detection

A context pack scans the project directory for known stable files:

| File | Rationale |
|------|-----------|
| `AGENTS.md` | Agent behavior instructions |
| `PROJECT_CONTEXT.md` | Project-specific context |
| `ARCHITECTURE.md` | System architecture docs |
| `CODING_RULES.md` | Coding standards |
| `TASKLIST.md` | Task tracking |
| `DECISIONS.md` | Architecture decisions |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `next.config.*` | Next.js configuration |
| `README.md` | Project readme |
| `docs/**/*.md` | All markdown docs recursively |

### Pack creation

When you build a context pack (via the "Rebuild Cache" button or `POST /api/projects/:id/context-cache/rebuild`):

1. Talocode finds all stable files in the project
2. Hashes each file individually (SHA-256, truncated to 16 hex chars)
3. Creates a manifest hash from the sorted file→hash mapping (order-independent)
4. Creates a content hash from the concatenation of all file contents
5. Estimates total tokens (characters ÷ 4, rounded up)
6. Stores the pack with status `active`

### How cache hit/miss is calculated

When you validate a context pack (via "Validate Cache" or `POST /api/projects/:id/context-cache/validate`):

1. Re-scan stable files in the project directory
2. Compute a current manifest hash from the files on disk
3. Compare against the stored `manifestHash`:

| Result | Manifest matches | All files exist |
|--------|-----------------|-----------------|
| **hit** | ✓ | ✓ |
| **stale** | ✗ | Some changed/missing |
| **miss** | — | Pack not found or error |
| **disabled** | — | No active pack exists |

A **hit** means the context pack is fresh — no stable files have changed. The pack's `cacheHitCount` is incremented and `lastUsedAt` is updated.

A **stale** result means one or more stable files have been modified, added, or deleted. The pack's `cacheMissCount` is incremented and `status` is set to `stale`. The specific changed files are returned.

### Token savings estimation

Token savings are estimated using a simple character-count heuristic:

```
estimatedTokens = ceil(content.length / 4)
savingsPercent = round(cachedTokens / totalTokens * 100)
```

This is **approximate** — real LLM tokenizers (tiktoken, etc.) produce different counts. The estimate is useful for gauging the relative value of caching, not for exact cost calculations.

**Examples:**
- 50% cached, 50% fresh → 50% savings
- 100% cached (all content in pack) → 100% savings
- 0% cached (stale pack) → 0% savings

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects/:projectId/context-cache` | Get all context packs and stats for a project |
| `POST` | `/api/projects/:projectId/context-cache/rebuild` | Rebuild the active context pack |
| `POST` | `/api/projects/:projectId/context-cache/validate` | Check if current pack is fresh or stale |
| `GET` | `/api/sessions/:sessionId/cache-meta` | Get cache metadata for a specific session |

## UI

The Context Cache panel appears inline in the Projects tab of the dashboard. Click "Cache" on any project to toggle it.

The panel shows:
- Active pack name and status badge
- Token metrics (estimated tokens, cached tokens, fresh tokens, savings %)
- Cache hit/miss counters
- Last used and last updated timestamps
- Changed files list (when stale)
- "Rebuild Cache" and "Validate Cache" buttons

## Data storage

Context packs are stored in the same `talocode.json` file as all other Talocode data, under the `contextPacks` array:

```json
{
  "contextPacks": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "name": "Project Context Pack",
      "description": "Auto-generated pack from 5 stable project files",
      "includedFiles": ["/path/to/AGENTS.md", ...],
      "contentHash": "abc123...",
      "manifestHash": "def456...",
      "estimatedTokens": 2500,
      "createdAt": "2026-05-16T...",
      "updatedAt": "2026-05-16T...",
      "lastUsedAt": "2026-05-16T...",
      "cacheHitCount": 3,
      "cacheMissCount": 1,
      "status": "active"
    }
  ]
}
```

## Adding provider-native prompt caching later

The context caching system is designed to be extended with provider-native caching:

1. **Anthropic Prompt Caching**: The `ContextPack` already tracks `contentHash` and `estimatedTokens`. When creating an Anthropic session, check the pack's cache status and annotate the system prompt blocks with `cache_control: { type: "ephemeral" }` if the pack is fresh.

2. **Google Gemini Context Caching**: The context pack's stable files could be uploaded to Gemini's context cache API, using the `contentHash` as the cache key.

3. **OpenAI Prompt Caching**: OpenAI automatically caches repeated prefixes. No explicit integration needed, but tracking hit/miss rates helps measure effectiveness.

The `context-cache.ts` service module exports provider-neutral functions (`computeCacheMeta`, `validateContextPack`, `estimateRunCacheUsage`) that any provider adapter can call before constructing a request.
