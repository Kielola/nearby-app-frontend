# Netlify deploy notes

## Build settings

`netlify.toml` in this folder configures Netlify automatically:

| Field | Value |
|---|---|
| Base directory | *(empty)* |
| Build command | `npm run build` |
| Publish directory | `dist` |

## Why `dist/server.cjs` is no longer produced

The build used to run a second step:

```
esbuild server.ts --bundle ... --outfile=dist/server.cjs
```

`server.ts` was an Express process that served the AI endpoints
(`/api/my-ai/chat`, `/api/ai-icebreaker`). Those endpoints now live in the
NestJS backend at `POST /ai/my-ai-chat` and `POST /ai/icebreaker`, so the
Express process is dead code.

That mattered here specifically: **everything in the publish directory is
served publicly on Netlify**, so `dist/server.cjs` would have been downloadable
at `https://<site>.netlify.app/server.cjs` — dead endpoints exposed to the
internet. Dropping the step removes it from the published output entirely.

`server.ts` is left in the repo (it is also the local dev server, via
`npm run dev`) but nothing publishes it now.
