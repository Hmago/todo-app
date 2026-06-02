// Web (and default) device-calendar service. The browser has no programmatic
// access to the user's Apple/Google calendar without a backend + OAuth, so these
// are safe no-op stubs. The native implementation (calendarSync.native.ts) uses
// expo-calendar for real two-way sync on iOS/Android.

import { Task } from '../types';

export type CalendarPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DeviceEvent {
  id: string;
  title: string;
  /** Local 'yyyy-MM-ddTHH:mm'. */
  start: string;
  end: string;
  allDay: boolean;
}

/** Device-calendar integration is available (native only). */
export function calendarSyncSupported(): boolean {
  return false;
}

export async function getCalendarPermission(): Promise<CalendarPermission> {
  return 'unsupported';
}

export async function requestCalendarPermission(): Promise<CalendarPermission> {
  return 'unsupported';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function exportTaskToCalendar(_task: Task, _dateKey: string): Promise<string | null> {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function importDeviceEvents(_dateKey: string): Promise<DeviceEvent[]> {
  return [];
}
