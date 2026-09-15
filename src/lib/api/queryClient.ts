import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './httpClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry auth failures — retrying a 401 just wastes 3 round
      // trips before showing the same error. Do retry transient network/
      // server errors, which retrying can actually fix.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});
