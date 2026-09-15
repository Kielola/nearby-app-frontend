import { useQuery } from '@tanstack/react-query';
import { postsApi, highlightsApi } from '../../../lib/api';

// One user's posts + highlights, polled. Used both for "my own profile"
// and "viewing a neighbor's profile" — same shape either way, backend
// doesn't distinguish (whether you can see them is enforced by whether
// you can resolve their conversation/friend state, same as before).
export function useUserContent(userId: string | null, enabled: boolean) {
  const postsQuery = useQuery({
    queryKey: ['posts', userId],
    queryFn: () => postsApi.forUser(userId!),
    enabled: enabled && Boolean(userId),
    refetchInterval: 60_000,
  });

  const highlightsQuery = useQuery({
    queryKey: ['highlights', userId],
    queryFn: () => highlightsApi.forUser(userId!),
    enabled: enabled && Boolean(userId),
    refetchInterval: 60_000,
  });

  return {
    posts: postsQuery.data ?? [],
    highlights: highlightsQuery.data ?? [],
    refetch: () => {
      postsQuery.refetch();
      highlightsQuery.refetch();
    },
  };
}
