import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { HacError } from '@/hac/client';
import {
  addTodo,
  deleteTodo,
  getCourseHistory,
  getGpaHistory,
  getSnapshot,
  listTodos,
  setTodoDone,
  type Todo,
} from '@/storage/db';
import { cancelReminder, scheduleReminder } from '@/sync/notifications';
import { syncGrades, type SyncResult } from '@/sync/sync';

import { getClient } from './session';

/**
 * React Query hooks: the only way screens load data.
 *
 * Grades come from `syncGrades`, so a refresh in the app also records history. If HAC
 * can't be reached, the grades hooks fall back to the last saved snapshot and set
 * `offline: true` so the UI can say "showing grades from <time>".
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof HacError && error.code === 'bad-credentials') && count < 1,
      staleTime: 5 * 60_000,
    },
  },
});

export interface GradesData extends SyncResult {
  offline: boolean;
}

const CURRENT = 'current';

async function loadGrades(markingPeriod?: string): Promise<GradesData> {
  try {
    return { ...(await syncGrades(getClient(), { markingPeriod })), offline: false };
  } catch (error) {
    if (error instanceof HacError && (error.code === 'network' || error.code === 'timeout')) {
      const snapshot = await getSnapshot(markingPeriod ?? CURRENT);
      if (snapshot) {
        return {
          page: { courses: snapshot.courses, markingPeriods: [] },
          changes: [],
          syncedAt: snapshot.takenAt,
          markingPeriod: snapshot.markingPeriod,
          offline: true,
        };
      }
    }
    throw error;
  }
}

/** Classes and assignments for a marking period (current when omitted). */
export function useGrades(markingPeriod?: string) {
  return useQuery({ queryKey: ['grades', markingPeriod ?? CURRENT], queryFn: () => loadGrades(markingPeriod) });
}

/** One course from `useGrades`, by section code. */
export function useCourse(courseId: string, markingPeriod?: string) {
  const q = useGrades(markingPeriod);
  return { ...q, course: q.data?.page.courses.find((c) => c.id === courseId) };
}

const HOUR = 60 * 60_000;

export const useSchedule = () => useQuery({ queryKey: ['schedule'], queryFn: () => getClient().getSchedule(), staleTime: 12 * HOUR });
export const useTranscript = () => useQuery({ queryKey: ['transcript'], queryFn: () => getClient().getTranscript(), staleTime: 12 * HOUR });
export const useReportCard = () => useQuery({ queryKey: ['reportCard'], queryFn: () => getClient().getReportCard(), staleTime: HOUR });
export const useProgressReport = () => useQuery({ queryKey: ['progress'], queryFn: () => getClient().getProgressReport(), staleTime: HOUR });
export const useAttendance = () => useQuery({ queryKey: ['attendance'], queryFn: () => getClient().getAttendance(), staleTime: HOUR });
export const useStudentInfo = () => useQuery({ queryKey: ['student'], queryFn: () => getClient().getStudentInfo(), staleTime: 24 * HOUR });

export const useCourseHistory = (courseId?: string) =>
  useQuery({ queryKey: ['history', courseId ?? 'all'], queryFn: () => getCourseHistory(courseId), staleTime: 0 });
export const useGpaHistory = () => useQuery({ queryKey: ['gpaHistory'], queryFn: getGpaHistory, staleTime: 0 });

// ---------- planner ----------

export const useTodos = () => useQuery({ queryKey: ['todos'], queryFn: listTodos, staleTime: Infinity });

export function useTodoActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['todos'] });

  const add = useMutation({
    mutationFn: async (input: { title: string; due: Date | null; courseId: string | null }) => {
      const notificationId = input.due ? await scheduleReminder(input.title, input.due) : null;
      await addTodo({ title: input.title, due: input.due?.toISOString() ?? null, courseId: input.courseId, notificationId });
    },
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: async (todo: Todo) => {
      if (!todo.done) await cancelReminder(todo.notificationId);
      await setTodoDone(todo.id, !todo.done);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (todo: Todo) => {
      await cancelReminder(todo.notificationId);
      await deleteTodo(todo.id);
    },
    onSuccess: refresh,
  });
  return { add, toggle, remove };
}
