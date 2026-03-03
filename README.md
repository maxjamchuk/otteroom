# Otteroom

Otteroom is a mobile-first app for picking a movie together in a shared "room".
Two people join via QR/code, set preferences (up to 5 genres), then swipe synced movie cards.
A match happens when both like the same movie.

## Stack
- Mobile: React Native + Expo + TypeScript
- Backend: Supabase (Postgres + Realtime + Edge Functions)
- Content: TMDB (via Edge Functions only)
- UI languages: RU/EN/DE/FR/ES/PT/TR/PL/IT
- Room content language: host device language
- Region: device region

## Stages
- Stage 0 (MVP): iOS/Android core flow for 2 users
- Stage 1 (Release-1): stability + store-ready polish
- Stage 2 (Release-2): Big Screen Web Display (browser)
- Stage 3 (Release-3): TV apps (Tizen/webOS) packaging of Web Display