import { useQuery } from '@tanstack/react-query';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Fetches effective feature flags for the current user's cluster.
 * Returns a map of featureKey → isEnabled.
 * Defaults all features to true while loading or on error.
 */
export function useFeatureFlags() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: flags = {} } = useQuery<Record<string, boolean>>({
    queryKey: ['effective-flags'],
    queryFn: () => api.get('/feature-flags/effective').then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 60_000, // cache for 1 minute
    refetchOnWindowFocus: true,
  });

  function isEnabled(key: string): boolean {
    return flags[key] ?? true; // default ON if not loaded yet
  }

  return { flags, isEnabled };
}
