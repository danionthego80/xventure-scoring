# xventure-scoring

XVenture Mind Games scoring app — admin panel and player-facing game scoring interface.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (shared with xventure-booking)

## Structure

```
app/
  score/[gameId]/    — Player-facing scoring page
  admin/             — Admin login and control panel
  admin/games/       — Game management (create, view, manage status)
  admin/themes/      — Theme management (create, edit questions)
lib/
  supabase.ts        — Supabase client
  utils.ts           — Utility functions
```

## Environment Variables

See `.env.example`. This app uses the **same Supabase project** as xventure-booking.
No Stripe keys are needed for the scoring app.

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| NEXT_PUBLIC_ADMIN_PASSWORD | Password for /admin login |

## Related

- [xventure-booking](https://github.com/danionthego80/xventure-booking) — Customer booking system (Stripe + Supabase)
# xventure-scoring
XVenture Mind Games scoring app — admin panel and player-facing game scoring interface
