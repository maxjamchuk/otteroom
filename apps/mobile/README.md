# Otteroom Mobile App

React Native + Expo mobile application for the Otteroom MVP.

## Prerequisites

- Node.js (LTS)
- pnpm (or npm)
- Expo CLI (via `npx expo`)
- Supabase project credentials

## Setup

### 1. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then fill in your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Locally

```bash
pnpm expo start
# or
npx expo start
```

Follow the on-screen prompts to run on iOS simulator, Android emulator, or physical device via Expo Go app.

## Development

### File Structure

- `app/` — expo-router routes
- `src/`
  - `components/` — reusable UI components
  - `screens/` — screen components (if not using route collocation)
  - `stores/` — Zustand stores (auth, room, voting)
  - `services/` — Supabase client, Edge Functions client
  - `i18n/` — localization dictionaries and init
  - `utils/` — helper functions

### Supported Languages

- Russian (RU)
- English (EN)
- German (DE)
- French (FR)
- Spanish (ES)
- Portuguese (PT)
- Turkish (TR)
- Polish (PL)
- Italian (IT)

## Testing

Run tests with:

```bash
pnpm test
# or
npm test
```

## Building for Production

### iOS

```bash
pnpm eas build --platform ios
```

### Android

```bash
pnpm eas build --platform android
```

See [Expo documentation](https://docs.expo.dev/build/introduction/) for more details.
