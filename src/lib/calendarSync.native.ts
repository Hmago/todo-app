// Native device-calendar service (iOS/Android) using expo-calendar.
// Provides two-way integration: push tasks out as calendar events and pull the
// user's existing events in for the agenda timeline. Requires a dev build
// (expo-calendar is a native module and is not available in a plain web bundle).

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { Task } from '../types';
import { toLocalIso, fromKey } from './dates';

export type CalendarPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DeviceEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export function calendarSyncSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function mapStatus(status: string): CalendarPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'default';
}

export async function getCalendarPermission(): Promise<CalendarPermission> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'unsupported';
  }
}

export async function requestCalendarPermission(): Promise<CalendarPermission> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

/** Find (or create) a calendar we can write events to. */
async function getWritableCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id) return def.id;
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.find((c) => c.allowsModifications);
    if (writable) return writable.id;
    if (Platform.OS === 'android') {
      const source =
        cals[0]?.source ?? { isLocalAccount: true, name: 'To Do' };
      return await Calendar.createCalendarAsync({
        title: 'To Do',
        color: '#a78bfa',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: cals[0]?.source?.id,
        source: source as any,
        name: 'To Do',
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }
    return null;
  } catch {
    return null;
  }
}

export async function exportTaskToCalendar(task: Task, dateKey: string): Promise<string | null> {
  try {
    const perm = await getCalendarPermission();
    if (perm !== 'granted') {
      const req = await requestCalendarPermission();
      if (req !== 'granted') return null;
    }
    const calendarId = await getWritableCalendarId();
    if (!calendarId) return null;

    const allDay = !!task.allDay || !task.time;
    let startDate: Date;
    let endDate: Date;
    if (allDay) {
      startDate = fromKey(dateKey);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(`${dateKey}T${task.time}:00`);
      const mins = task.estimateMinutes && task.estimateMinutes > 0 ? task.estimateMinutes : 60;
      endDate = new Date(startDate.getTime() + mins * 60 * 1000);
    }

    return await Calendar.createEventAsync(calendarId, {
      title: task.title,
      notes: task.notes,
      startDate,
      endDate,
      allDay,
    });
  } catch {
    return null;
  }
}

export async function importDeviceEvents(dateKey: string): Promise<DeviceEvent[]> {
  try {
    const perm = await getCalendarPermission();
    if (perm !== 'granted') return [];
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (cals.length === 0) return [];
    const start = fromKey(dateKey);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const events = await Calendar.getEventsAsync(
      cals.map((c) => c.id),
      start,
      end,
    );
    return events.map((e) => ({
      id: e.id,
      title: e.title || '(busy)',
      start: toLocalIso(new Date(e.startDate as string)),
      end: toLocalIso(new Date(e.endDate as string)),
      allDay: !!e.allDay,
    }));
  } catch {
    return [];
  }
}
