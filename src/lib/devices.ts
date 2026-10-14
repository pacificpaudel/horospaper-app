import { redis } from "@/lib/redis";

// Android app installs (the Capacitor app) that get the daily push
// notification and home-screen widgets. Unlike everything else in the app
// (kept for 24 hours), a registered device's record -- and its birth
// profile, see profile.ts -- is kept until the user deletes it in the app
// (or Firebase reports the app uninstalled), since the server makes each
// morning's Luck Chart and wallpaper for it before the user opens the app.

/** Set of every registered guest id, for the morning push run. */
const DEVICES_KEY = "devices";
/** When, in the device's own time zone, the morning notification goes out. */
export const DEFAULT_NOTIFY_HOUR = 6;

export interface Device {
  /** Firebase Cloud Messaging token for this app install. */
  token: string;
  /** The zone the phone is in now -- what decides when its day starts. */
  timezone: string;
  notifyHour: number;
  /** Local date (YYYY-MM-DD) of the last morning push, so each day gets one. */
  lastSentDate: string | null;
  registeredAt: string;
}

export const deviceKey = (userId: string) => `device:${userId}`;

export async function getDevice(userId: string): Promise<Device | null> {
  return (await redis.get<Device>(deviceKey(userId))) ?? null;
}

export async function isRegisteredDevice(userId: string): Promise<boolean> {
  return (await redis.exists(deviceKey(userId))) === 1;
}

/** Registers (or refreshes the token and zone of) this guest's app install. */
export async function registerDevice(userId: string, token: string, timezone: string): Promise<Device> {
  const existing = await getDevice(userId);
  const device: Device = {
    token,
    timezone,
    notifyHour: existing?.notifyHour ?? DEFAULT_NOTIFY_HOUR,
    lastSentDate: existing?.lastSentDate ?? null,
    registeredAt: existing?.registeredAt ?? new Date().toISOString(),
  };
  await Promise.all([redis.set(deviceKey(userId), device), redis.sadd(DEVICES_KEY, userId)]);
  return device;
}

export async function markPushSent(userId: string, device: Device, localDate: string): Promise<void> {
  await redis.set(deviceKey(userId), { ...device, lastSentDate: localDate });
}

export async function unregisterDevice(userId: string): Promise<void> {
  await Promise.all([redis.del(deviceKey(userId)), redis.srem(DEVICES_KEY, userId)]);
}

export async function listDeviceUserIds(): Promise<string[]> {
  return (await redis.smembers(DEVICES_KEY)) ?? [];
}
