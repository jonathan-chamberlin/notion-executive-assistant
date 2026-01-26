/**
 * CalendarSkill - Google Calendar management for Clawdbot
 *
 * This skill provides calendar operations via Google Calendar API.
 * Events can be linked to Notion tasks for unified management.
 */

import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

// OAuth2 scopes needed
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Pending action storage (for confirmations)
let pendingAction = null;

/**
 * Validate environment variables
 */
function validateEnv() {
  const errors = [];
  if (!process.env.GOOGLE_CREDENTIALS_PATH) {
    errors.push('GOOGLE_CREDENTIALS_PATH is not set');
  }
  if (!process.env.GOOGLE_TOKEN_PATH) {
    errors.push('GOOGLE_TOKEN_PATH is not set');
  }
  return errors;
}

/**
 * Log an action for auditability
 */
function logAction(action, details) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    skill: 'CalendarSkill',
    action,
    timestamp,
    ...details,
  }));
}

/**
 * Load OAuth2 credentials and create client
 */
async function getAuthClient() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
  const tokenPath = process.env.GOOGLE_TOKEN_PATH;

  try {
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Try to load existing token
    try {
      const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    } catch {
      return { needsAuth: true, client: oAuth2Client };
    }
  } catch (error) {
    throw new Error(`Failed to load credentials: ${error.message}`);
  }
}

/**
 * Parse natural language date into Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lower = dateStr.toLowerCase().trim();

  if (lower === 'today') {
    return today;
  }
  if (lower === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return today;
  }

  // Day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.indexOf(lower);
  if (dayIndex !== -1) {
    const currentDay = today.getDay();
    let daysUntil = dayIndex - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    today.setDate(today.getDate() + daysUntil);
    return today;
  }

  // Try parsing as date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Parse time string (HH:MM) into hours and minutes
 */
function parseTime(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return {
      hours: parseInt(match[1], 10),
      minutes: parseInt(match[2], 10),
    };
  }

  // Try 12-hour format
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const isPM = match12[3].toLowerCase() === 'pm';

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    return { hours, minutes };
  }

  return null;
}

/**
 * Get calendar ID from env or default
 */
function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || 'primary';
}

/**
 * List events for a date range
 */
export async function listEvents({ date, range = 'day' }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  try {
    const authResult = await getAuthClient();
    if (authResult.needsAuth) {
      return {
        success: false,
        error: 'Google Calendar not authorized. Run /calendar setup first.',
        needsAuth: true,
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: authResult });
    const calendarId = getCalendarId();

    // Determine date range
    let startDate = date ? parseDate(date) : new Date();
    if (!startDate) {
      return { success: false, error: `Invalid date: ${date}` };
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    if (range === 'week') {
      endDate.setDate(endDate.getDate() + 7);
    } else {
      endDate.setDate(endDate.getDate() + 1);
    }

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (response.data.items || []).map(event => ({
      id: event.id,
      title: event.summary || 'Untitled',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location || null,
      description: event.description || null,
      attendees: (event.attendees || []).map(a => a.email),
      link: event.htmlLink,
    }));

    logAction('list', { date: startDate.toISOString(), range, eventCount: events.length });

    return { success: true, events };
  } catch (error) {
    logAction('list_error', { date, range, error: error.message });
    return { success: false, error: `Calendar API error: ${error.message}` };
  }
}

/**
 * Create a new calendar event
 */
export async function createEvent({ title, date, time, duration = 60, attendees, location, description }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  // Validate inputs
  if (!title || title.trim().length === 0) {
    return { success: false, error: 'Event title is required' };
  }
  if (!date) {
    return { success: false, error: 'Event date is required' };
  }
  if (!time) {
    return { success: false, error: 'Event time is required' };
  }

  const eventDate = parseDate(date);
  if (!eventDate) {
    return { success: false, error: `Invalid date: ${date}` };
  }

  const eventTime = parseTime(time);
  if (!eventTime) {
    return { success: false, error: `Invalid time: ${time}. Use HH:MM format.` };
  }

  try {
    const authResult = await getAuthClient();
    if (authResult.needsAuth) {
      return {
        success: false,
        error: 'Google Calendar not authorized. Run /calendar setup first.',
        needsAuth: true,
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: authResult });
    const calendarId = getCalendarId();

    // Build start and end times
    const startDateTime = new Date(eventDate);
    startDateTime.setHours(eventTime.hours, eventTime.minutes, 0, 0);

    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + duration);

    const event = {
      summary: title.trim(),
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (location) {
      event.location = location;
    }

    if (description) {
      event.description = description;
    }

    if (attendees) {
      const attendeeList = Array.isArray(attendees) ? attendees : attendees.split(',').map(e => e.trim());
      event.attendees = attendeeList.map(email => ({ email }));
    }

    const response = await calendar.events.insert({
      calendarId,
      resource: event,
      sendUpdates: attendees ? 'all' : 'none',
    });

    const createdEvent = {
      id: response.data.id,
      title: response.data.summary,
      start: response.data.start.dateTime,
      end: response.data.end.dateTime,
      link: response.data.htmlLink,
    };

    logAction('create', createdEvent);

    return { success: true, event: createdEvent };
  } catch (error) {
    logAction('create_error', { title, date, time, error: error.message });
    return { success: false, error: `Failed to create event: ${error.message}` };
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(eventId, updates) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!eventId) {
    return { success: false, error: 'Event ID is required' };
  }

  try {
    const authResult = await getAuthClient();
    if (authResult.needsAuth) {
      return {
        success: false,
        error: 'Google Calendar not authorized. Run /calendar setup first.',
        needsAuth: true,
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: authResult });
    const calendarId = getCalendarId();

    // Get existing event
    const existing = await calendar.events.get({ calendarId, eventId });
    const event = existing.data;

    // Apply updates
    if (updates.title) {
      event.summary = updates.title.trim();
    }

    if (updates.date || updates.time) {
      const currentStart = new Date(event.start.dateTime || event.start.date);

      if (updates.date) {
        const newDate = parseDate(updates.date);
        if (!newDate) {
          return { success: false, error: `Invalid date: ${updates.date}` };
        }
        currentStart.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
      }

      if (updates.time) {
        const newTime = parseTime(updates.time);
        if (!newTime) {
          return { success: false, error: `Invalid time: ${updates.time}` };
        }
        currentStart.setHours(newTime.hours, newTime.minutes);
      }

      // Calculate duration and update end time
      const currentEnd = new Date(event.end.dateTime || event.end.date);
      const duration = currentEnd.getTime() - new Date(event.start.dateTime || event.start.date).getTime();
      const newEnd = new Date(currentStart.getTime() + duration);

      event.start = { dateTime: currentStart.toISOString() };
      event.end = { dateTime: newEnd.toISOString() };
    }

    if (updates.location) {
      event.location = updates.location;
    }

    if (updates.description) {
      event.description = updates.description;
    }

    if (updates.addAttendee) {
      event.attendees = event.attendees || [];
      event.attendees.push({ email: updates.addAttendee });
    }

    const response = await calendar.events.update({
      calendarId,
      eventId,
      resource: event,
      sendUpdates: 'all',
    });

    logAction('update', { eventId, updates });

    return {
      success: true,
      event: {
        id: response.data.id,
        title: response.data.summary,
        start: response.data.start.dateTime,
        end: response.data.end.dateTime,
        link: response.data.htmlLink,
      }
    };
  } catch (error) {
    logAction('update_error', { eventId, updates, error: error.message });
    return { success: false, error: `Failed to update event: ${error.message}` };
  }
}

/**
 * Cancel/delete an event
 */
export async function cancelEvent(eventId, { notify = true, confirmed = false } = {}) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!eventId) {
    return { success: false, error: 'Event ID is required' };
  }

  // Require confirmation
  if (!confirmed) {
    pendingAction = { type: 'cancel', eventId, notify };
    return {
      success: false,
      needsConfirmation: true,
      message: `Are you sure you want to cancel this event? Use /calendar confirm to proceed.`,
    };
  }

  try {
    const authResult = await getAuthClient();
    if (authResult.needsAuth) {
      return {
        success: false,
        error: 'Google Calendar not authorized. Run /calendar setup first.',
        needsAuth: true,
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: authResult });
    const calendarId = getCalendarId();

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: notify ? 'all' : 'none',
    });

    logAction('cancel', { eventId, notify });

    return { success: true, message: 'Event cancelled successfully.' };
  } catch (error) {
    logAction('cancel_error', { eventId, error: error.message });
    return { success: false, error: `Failed to cancel event: ${error.message}` };
  }
}

/**
 * Confirm pending action
 */
export async function confirmAction() {
  if (!pendingAction) {
    return { success: false, error: 'No pending action to confirm.' };
  }

  const action = pendingAction;
  pendingAction = null;

  if (action.type === 'cancel') {
    return cancelEvent(action.eventId, { notify: action.notify, confirmed: true });
  }

  return { success: false, error: 'Unknown pending action type.' };
}

/**
 * Find free time slots on a given date
 */
export async function findFreeTime({ date, duration = 60 }) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  const targetDate = date ? parseDate(date) : new Date();
  if (!targetDate) {
    return { success: false, error: `Invalid date: ${date}` };
  }

  try {
    const authResult = await getAuthClient();
    if (authResult.needsAuth) {
      return {
        success: false,
        error: 'Google Calendar not authorized. Run /calendar setup first.',
        needsAuth: true,
      };
    }

    const calendar = google.calendar({ version: 'v3', auth: authResult });
    const calendarId = getCalendarId();

    // Get events for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(8, 0, 0, 0); // Working hours start

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(18, 0, 0, 0); // Working hours end

    const response = await calendar.events.list({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Find gaps
    const freeSlots = [];
    let currentTime = startOfDay.getTime();

    for (const event of events) {
      const eventStart = new Date(event.start.dateTime || event.start.date).getTime();
      const eventEnd = new Date(event.end.dateTime || event.end.date).getTime();

      // Check if there's a gap before this event
      if (eventStart - currentTime >= duration * 60 * 1000) {
        freeSlots.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(eventStart).toISOString(),
          durationMinutes: Math.floor((eventStart - currentTime) / 60000),
        });
      }

      currentTime = Math.max(currentTime, eventEnd);
    }

    // Check for gap after last event
    if (endOfDay.getTime() - currentTime >= duration * 60 * 1000) {
      freeSlots.push({
        start: new Date(currentTime).toISOString(),
        end: endOfDay.toISOString(),
        durationMinutes: Math.floor((endOfDay.getTime() - currentTime) / 60000),
      });
    }

    logAction('find_free', { date: targetDate.toISOString(), duration, slotsFound: freeSlots.length });

    return { success: true, freeSlots };
  } catch (error) {
    logAction('find_free_error', { date, duration, error: error.message });
    return { success: false, error: `Failed to find free time: ${error.message}` };
  }
}

/**
 * Generate OAuth authorization URL (for initial setup)
 */
export async function getAuthUrl() {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  try {
    const authResult = await getAuthClient();
    if (!authResult.needsAuth) {
      return { success: true, message: 'Already authorized.' };
    }

    const authUrl = authResult.client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    return {
      success: true,
      authUrl,
      message: 'Visit this URL to authorize, then use /calendar auth <code> with the code.',
    };
  } catch (error) {
    return { success: false, error: `Failed to generate auth URL: ${error.message}` };
  }
}

/**
 * Complete OAuth flow with authorization code
 */
export async function authorize(code) {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    return { success: false, error: envErrors.join(', ') };
  }

  if (!code) {
    return { success: false, error: 'Authorization code is required' };
  }

  try {
    const authResult = await getAuthClient();
    const client = authResult.needsAuth ? authResult.client : authResult;

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Save token
    const tokenPath = process.env.GOOGLE_TOKEN_PATH;
    await fs.writeFile(tokenPath, JSON.stringify(tokens));

    logAction('authorize', { success: true });

    return { success: true, message: 'Google Calendar authorized successfully!' };
  } catch (error) {
    logAction('authorize_error', { error: error.message });
    return { success: false, error: `Authorization failed: ${error.message}` };
  }
}

// Default export for Clawdbot skill registration
export default {
  name: 'CalendarSkill',
  description: 'Manage Google Calendar events',
  functions: {
    listEvents,
    createEvent,
    updateEvent,
    cancelEvent,
    confirmAction,
    findFreeTime,
    getAuthUrl,
    authorize,
  },
};
