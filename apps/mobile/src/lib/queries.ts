import { computeAverage, type Course } from '@sg/core';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './api';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
});

/** Latest grades for a student profile, with averages recomputed locally from @sg/core. */
export function useCourses(studentId: string | undefined) {
  return useQuery({
    queryKey: ['courses', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { courses } = await api<{ courses: Course[] }>('/api/hac/sync', { studentId });
      return courses.map((c) => ({
        ...c,
        computedAverage: computeAverage(c.categories, c.assignments).average,
      }));
    },
  });
}
