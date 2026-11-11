# RPCPH CRM — React migration preview

This is an isolated React/Vite implementation for the next RPCPH CRM frontend.

- Production `main` is not changed by this preview.
- React is the only frontend framework.
- Vite is the build tool.
- Motion for React handles component and page transitions.
- Supabase remains the existing data service.
- The ID KEY authentication flow continues to use the existing `rpcph-local-auth` Edge Function and the same browser session storage key.
- The current Admin Import, User Administration, Area Manager and Database HTML pages are copied into `public/` temporarily so links stay on this preview origin while those pages are migrated.

## Commands

```sh
npm install
npm run dev
npm run build
```

The root dashboard recreates the current lead-first workflow. The agent matching uses active territory assignments and the original service-area text, then sorts agents with current geocoded office locations by distance when county coordinates are available.
