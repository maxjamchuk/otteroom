export function readPublicEnv(): { url: string; publishableKey: string } {
  // Expo inlines only these explicit public references. Never read the whole env.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const invalid = (field: string): never => {
    throw new Error(`Invalid ${field}. Run npm run env:local with local Supabase running.`);
  };
  try {
    const parsed = new URL(url ?? '');
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      invalid('EXPO_PUBLIC_SUPABASE_URL');
    }
  } catch { invalid('EXPO_PUBLIC_SUPABASE_URL'); }
  if (!publishableKey?.trim() || publishableKey.startsWith('sb_secret_')) invalid('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return { url: url!, publishableKey: publishableKey! };
}
