# Next Team

Team management for kids' sports clubs (football, basketball and more; sports are rows in the `sports` table, each with its own icon). React + TypeScript (Vite, PWA), Supabase (Postgres, Auth, RLS), Cloudflare Pages. Hebrew, RTL, mobile first.

## Status

Stage C1 (foundations): database schema, RLS policies, RPCs, email login (emailed link/code or Google), app shell,
events list and event page with transport, joining a team by link with approval, profiles, player and team pages,
in-app notifications and free Web Push.

Verified here: `npm run typecheck` and `npm run build` pass, and the three migrations apply cleanly on Postgres 16
(against a stub `auth` schema) with a per-role scenario test (club creation, invites, coach limits, player cannot post,
parent sees messages only after coach approval, outsider sees nothing).
**Not verified:** real Supabase (`supabase start`), real SMS delivery, and the UI in a browser.

Migrations: `supabase/migrations` mirrors the live project. `0004b`, `0010a` and `0020b2` reconstruct changes that
were made on the live project by hand; they are already in effect there and exist so a fresh database
(`supabase db reset`) ends up the same. `0001`–`0021` are applied to the live project (`0012`–`0021` were copied
from it and match it byte for byte; functions, columns and policies match it too). `0022`–`0025` were applied to the
live project from this repo.
This project uses Supabase's newer defaults, where new tables get no select/insert/update/delete for
`anon`/`authenticated`: every new table needs explicit grants next to its RLS policies (see `0011`).

Event transport (`0022`): the coach or club admin turns transport on for an event (`set_event_transport`).
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

Joining (`0023`): staff open their team page and share its join link (`/join/<code>`). Whoever opens it signs in
and asks to join as a parent (listing their children: name, birth date, optional email and phone) or as staff.
Club admins decide staff requests; the team's staff and club admins decide parent requests (Requests screen).
Approving a parent creates the children as players (or links ones already on the roster); a child's email is linked
to the player, so the child can sign in later. Players never register themselves.

Push (`0024`, `0025`, `supabase/functions/send-push`): each new row in `notifications` is posted by a trigger (pg_net)
to the `send-push` function, which sends it to the recipient's subscribed devices. Settings live in Vault:
`push_hook_url`, `push_hook_secret`, and the VAPID key pair the function makes on its first call (see `0025` for
the one-time setup on a new project). On iPhone, push works only from the app added to the home screen (iOS 16.4+).

Login is by email: a code sent to the address, or Google. Invites are by email too (`invite_by_email`,
`invite_parent`, `link_player_email`); no email is sent for an invite, the person signs in with that address and
`claim_invites` gives them their role. For Google sign-in, add the app's URL to Supabase Auth → URL Configuration.

Decisions made while implementing: only a system admin creates clubs (optionally naming the first club admin by email);
old phone functions remain as `*_legacy`, revoked from every role.

## Open points to confirm
1. Who starts a parent-child link: either side, by the other's email; the child's team coach approves (implemented that way).
2. A coach may invite players and parents to his own team; a club admin may invite any role.
3. v1 messages are one channel per team (no private chat); players read only.
4. Set a system admin by hand: `update profiles set is_system_admin = true where id = '<uuid>';`

## Next (C2)
Clubs/teams admin screens, invite by email, guardianship request and approval, RLS test script per role.
