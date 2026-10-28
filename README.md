# Next Team

Team management for kids' sports clubs (football, basketball and more; sports are rows in the `sports` table, each with its own icon). React + TypeScript (Vite, PWA), Supabase (Postgres, Auth, RLS), Cloudflare Pages. Hebrew, RTL, mobile first.

## Status

Stage C1 (foundations): database schema, RLS policies, RPCs, phone + SMS login, role shell.

Verified here: `npm run typecheck` and `npm run build` pass, and the three migrations apply cleanly on Postgres 16
(against a stub `auth` schema) with a per-role scenario test (club creation, invites, coach limits, player cannot post,
parent sees messages only after coach approval, outsider sees nothing).
**Not verified:** real Supabase (`supabase start`), real SMS delivery, and the UI in a browser.

Migrations: `supabase/migrations` mirrors the live project. `0004b` and `0010a` reconstruct changes that were
made on the live project by hand; they are already in effect there and exist so a fresh database
(`supabase db reset`) ends up the same. `0011` (security hardening) is applied to the live project.
This project uses Supabase's newer defaults, where new tables get no select/insert/update/delete for
`anon`/`authenticated`: every new table needs explicit grants next to its RLS policies (see `0011`).
`0012` (event transport) is not yet applied to the live project.

Event transport (`0012`): the coach or club admin turns transport on for an event (`set_event_transport`).
A parent then sets the seats for their child, counting the child and anyone travelling with them (0 = no ride);
staff set their own seats, and staff can set or correct any row (`set_transport_seats`). Players cannot set seats.
`event_transport_list` gives the breakdown and `event_transport_total` the total, to any team member.
A player answered "not attending" loses their row and cannot be given seats.

First run:

```bash
npm install
npx supabase start          # needs Docker
npx supabase db reset       # applies supabase/migrations/*
cp .env.example .env        # fill in the local anon key printed by `supabase start`
npm run dev
```

SMS login needs a provider configured in `supabase/config.toml` (`[auth.sms]`, e.g. Twilio).
For local development `[auth.sms.test_otp]` maps test number `+972500000000` to code `123456`.

Decisions made while implementing: only a system admin creates clubs (optionally naming the first club admin by phone);
phones are stored as E.164 and a leading `0` is read as Israel (`+972`).

## Open points to confirm
1. Who starts a parent-child link: either side, by the other's phone number; the child's team coach approves (implemented that way).
2. A coach may invite players and parents to his own team; a club admin may invite any role.
3. v1 messages are one channel per team (no private chat); players read only.
4. Set a system admin by hand: `update profiles set is_system_admin = true where id = '<uuid>';`

## Next (C2)
Clubs/teams admin screens, invite by phone, guardianship request and approval, RLS test script per role.
