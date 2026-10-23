import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { kvGet, kvSet } from '@/storage/db';

/**
 * Due-date calendar sync: keeps a "GradeGupta" calendar on the phone with an all-day event
 * for each upcoming, ungraded HAC assignment.
 *
 * Uses the legacy expo-calendar API because it works in Expo Go as well as in builds.
 * Event ids are remembered per account (kv `calendarEvents:<accountId>`) so syncing again
 * never creates duplicates, and events for work that's been graded or removed are deleted.
 */

const CALENDAR_TITLE = 'GradeGupta';

export interface DueItem {
  /** Assignment id (stable across syncs). */
  id: string;
  title: string;
  course: string;
  /** YYYY-MM-DD */
  due: string;
}

async function calendarId(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === CALENDAR_TITLE && c.allowsModifications);
  if (existing) return existing.id;

  const source =
    Platform.OS === 'ios'
      ? (await Calendar.getDefaultCalendarAsync()).source
      : { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL };
  return Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    name: 'gradegupta',
    color: '#3550E8',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: Platform.OS === 'ios' ? (source as Calendar.Source).id : undefined,
    source: source as Calendar.Source,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

/** Adds new due dates, removes ones no longer upcoming. Returns how many were added/removed. */
export async function syncDueDates(items: DueItem[], accountId: string): Promise<{ added: number; removed: number }> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) throw new Error('Allow calendar access in your phone’s settings to add due dates.');

  const key = `calendarEvents:${accountId}`;
  const known = (await kvGet<Record<string, string>>(key)) ?? {};
  const id = await calendarId();
  const wanted = new Set(items.map((i) => i.id));
  let added = 0;
  let removed = 0;

  for (const item of items) {
    if (known[item.id]) continue;
    const start = new Date(`${item.due}T00:00:00`);
    known[item.id] = await Calendar.createEventAsync(id, {
      title: `${item.title} (${item.course})`,
      startDate: start,
      endDate: new Date(start.getTime() + 24 * 60 * 60_000),
      allDay: true,
      notes: 'Due date from Home Access Center, added by GradeGupta.',
    });
    added++;
  }

  for (const [assignmentId, eventId] of Object.entries(known)) {
    if (wanted.has(assignmentId)) continue;
    await Calendar.deleteEventAsync(eventId).catch(() => {});
    delete known[assignmentId];
    removed++;
  }

  await kvSet(key, known);
  return { added, removed };
}
