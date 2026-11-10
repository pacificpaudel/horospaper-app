"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ensureGuestId } from "@/lib/client/guest";

interface GoogleAccount {
  email: string;
  name: string;
}

interface AccountLocation {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export function GoogleAuthControl() {
  const [account, setAccount] = useState<GoogleAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<AccountLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [todayAvailable, setTodayAvailable] = useState(false);
  const autoLocationAttempted = useRef(false);
  const locationBusyRef = useRef(false);

  const detectLocation = useCallback(async () => {
    if (locationBusyRef.current) return;
    if (!navigator.geolocation) {
      setLocationMessage("Location isn’t available in this browser.");
      return;
    }
    locationBusyRef.current = true;
    setLocationBusy(true);
    setLocationMessage("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
      });
      const response = await fetch("/api/account/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!response.ok) throw new Error("Could not save location");
      const data = await response.json() as { location: AccountLocation };
      setLocation(data.location);
    } catch {
      setLocationMessage("Allow location access to show your current place.");
    } finally {
      locationBusyRef.current = false;
      setLocationBusy(false);
    }
  }, []);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("googleLogin");
    if (reason === "not-configured") setMessage("Google sign-in isn’t configured yet.");
    else if (reason === "declined") setMessage("Google sign-in was cancelled.");
    else if (reason) setMessage("Google sign-in couldn’t be completed. Please try again.");
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (data: { account?: GoogleAccount | null }) => {
        const signedIn = data.account ?? null;
        setAccount(signedIn);
        if (!signedIn) return;
        try {
          const saved = await fetch("/api/account/location", { cache: "no-store" });
          const locationData = await saved.json() as { location?: AccountLocation | null };
          if (locationData.location) setLocation(locationData.location);
          else if (!autoLocationAttempted.current) {
            autoLocationAttempted.current = true;
            void detectLocation();
          }
        } catch {
          setLocationMessage("Could not load your saved location.");
        }
      })
      .catch(() => setAccount(null))
      .finally(() => setLoaded(true));

    const guestId = ensureGuestId();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/horoscope/today?timezone=${encodeURIComponent(timezone)}`, {
      cache: "no-store",
      headers: { "x-guest-id": guestId },
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { available?: boolean } | null) => setTodayAvailable(Boolean(data?.available)))
      .catch(() => setTodayAvailable(false));

    const onTodayAvailable = () => setTodayAvailable(true);
    window.addEventListener("horospaper:today-available", onTodayAvailable);
    return () => window.removeEventListener("horospaper:today-available", onTodayAvailable);
  }, [detectLocation]);

  const signIn = () => {
    const guestId = ensureGuestId();
    window.location.href = `/api/auth/google?guestId=${encodeURIComponent(guestId)}`;
  };

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAccount(null);
      setLocation(null);
    } finally {
      setBusy(false);
    }
  };

  if (account) {
    return (
      <div className="google-account-control" title={account.email}>
        {todayAvailable && <a href={`/home?showToday=1&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`} className="today-header-button" title="Open today's saved wallpaper">Today</a>}
        <Link href="/calendar" className="calendar-header-button" aria-label="Open your luck calendar" title="Luck calendar">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
          </svg>
        </Link>
        <button
          type="button"
          className="account-location-button"
          onClick={detectLocation}
          disabled={locationBusy}
          title={locationMessage || (location ? `${location.label} · Update location` : "Set your current location")}
          aria-label={location ? `Current location: ${location.label}. Update location` : "Set your current location"}
        >
          <span aria-hidden="true">{locationBusy ? "…" : "⌖"}</span>
          <span className="account-location-label">{locationBusy ? "Locating…" : location?.label ?? "Set location"}</span>
        </button>
        <button type="button" className="google-account-profile" aria-label={`Signed in as ${account.name || account.email}`}>
          {(account.name || account.email).charAt(0).toUpperCase()}
        </button>
        <button type="button" className="google-account-signout" onClick={signOut} disabled={busy} title="Sign out" aria-label="Sign out of Google">
          {busy ? "…" : "↪"}
        </button>
      </div>
    );
  }

  return (
    <div className="google-auth-control">
      {todayAvailable && <a href={`/home?showToday=1&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`} className="today-header-button" title="Open today's saved wallpaper">Today</a>}
      <button type="button" className="google-signin-button" onClick={signIn} aria-label="Sign in with Google" title={loaded ? "Sign in with Google" : "Google sign in"}>
        <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8V33c3.4 6.7 10.3 11 18.2 11Z" />
          <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.4H5.8a20 20 0 0 0 0 18Z" />
          <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4 16.1 4 9.2 8.3 5.8 15l6.8 5.4C14.2 15.6 18.7 12 24 12Z" />
        </svg>
      </button>
      {message && <span className="google-auth-message" role="status">{message}</span>}
    </div>
  );
}
