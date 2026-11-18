# GoTubeTV — global platform starter

This is a deployable full-stack starter (Next.js + Supabase), not a hosted live website.
It intentionally starts with an empty video feed.

## Included
- Email/password registration and login through Supabase Auth
- Public profile records
- Video upload to cloud storage and public video feed
- Owner-only indicator and separate "Logowanie do Właściciela" entry point
- Database tables and row-level security policies for videos, comments, likes and subscriptions

## Before launch
This starter is not yet a complete production YouTube-scale service. It still needs:
- real owner provisioning through trusted server-side admin tooling
- full channel/profile pages, comments/likes/subscription UI, playlists and moderation dashboard
- video transcoding, thumbnails, streaming/CDN, quotas and abuse reporting
- content moderation, copyright/takedown process, privacy policy, terms and age-appropriate safety controls
- rate limiting, email verification, backups, monitoring and security review

## Setup
1. An adult project owner should create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and anon key.
4. Run `npm install`, then `npm run dev`.
5. Deploy the app to a hosting provider that supports Next.js and set the same environment variables there.

Do not put Supabase service-role keys, owner passwords, or other secrets in browser code or Git.
Never set `profiles.is_owner` from a public client. Assign the owner role only from trusted admin tooling after verifying the owner's identity.
The special owner login link uses the normal secure sign-in; authorization comes from the server-controlled `is_owner` flag, not a secret button or hardcoded password.

## Important limits
The video bucket in this starter is public for easy playback of public uploads. Anyone with a public video URL may be able to watch it. Before real public launch, add private storage/signed URLs for private and unlisted videos and a moderation/review workflow.
