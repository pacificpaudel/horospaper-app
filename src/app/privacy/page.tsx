import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { Logo } from "@/components/Logo";
import { DeleteMyData } from "@/components/DeleteMyData";

// The privacy policy -- Google Play requires one for the Android app, and
// its Data safety form should say the same things. Keep it in step with
// what the app actually collects and who it's shared with.

/** Where people can reach you about their data. Set this before publishing. */
const CONTACT_EMAIL = "your-email@example.com";
const LAST_UPDATED = "14 October 2026";

export const metadata: Metadata = {
  title: "Privacy policy — horospaper",
  description: "What horospaper collects, why, and how long it keeps it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:px-8">
      <Link href="/home" aria-label="Back to horospaper">
        <Logo />
      </Link>
      <GlassCard as="section" className="privacy-policy mt-8">
        <h1>Privacy policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          horospaper turns your birth details and today&apos;s sky into a daily Vedic reading and wallpaper. It is built to need as
          little about you as possible: there are no accounts, no names, no email addresses and no advertising.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Birth details you enter</strong>: date and time of birth, birth place (city, its coordinates and time zone), and
            your rashi if you choose it. These are needed to calculate your chart.
          </li>
          <li>
            <strong>A random device ID</strong>, made in your browser the first time you use the app and kept in its local storage, so
            today&apos;s reading stays yours. It is not linked to your name, phone or any account.
          </li>
          <li>
            <strong>A saved draft of the form</strong>, kept only in your own browser&apos;s local storage so you don&apos;t have to retype
            it. It never leaves your device unless you generate a reading.
          </li>
        </ul>
        <p>
          <strong>In the Android app</strong>, also: a push notification token (an address Google&apos;s Firebase service gives the app,
          so we can send your morning notification) and your phone&apos;s time zone (so it arrives in your morning).
        </p>
        <p>We do not collect your contacts, photos, precise device location, or anything else from your phone.</p>

        <h2>How long we keep it</h2>
        <p>
          On the website, your birth details and the day&apos;s reading are stored for <strong>24 hours</strong> and then deleted
          automatically.
        </p>
        <p>
          In the Android app, your birth details and push token are kept <strong>until you delete them</strong> (below), or until you
          uninstall the app — so each morning&apos;s Luck Chart, wallpaper and widgets can be ready before you open it. Each day&apos;s
          reading is still deleted after 24 hours.
        </p>
        <p>Wallpaper images made for you are stored at private, unguessable addresses so they can be shown and downloaded.</p>

        <h2>Who it is shared with</h2>
        <p>To make your reading, the app uses these services, each only for its own part of the work:</p>
        <ul>
          <li>Astrology calculation services (freeastrologyapi.com and freeastroapi.com): your birth date, time and place, to calculate your chart and the day&apos;s Panchang.</li>
          <li>OpenStreetMap (Nominatim): the city name you search for, to find its coordinates.</li>
          <li>An AI writing service (Anthropic): your chart&apos;s planet positions and signs — not your birth date or place — to write the reading.</li>
          <li>Photo libraries (Unsplash and Openverse): only a general search word for the day, such as &ldquo;office&rdquo; or &ldquo;temple&rdquo;.</li>
          <li>Hosting and storage (Vercel and Upstash): to run the app and keep the data above.</li>
          <li>Google Firebase Cloud Messaging (Android app only): your push token and the notification&apos;s text and picture, to deliver it.</li>
        </ul>
        <p>We never sell your data, and it is never used for advertising.</p>

        <h2>Your choices</h2>
        <p>
          You can delete everything we keep for this device — birth details, readings and the app&apos;s notification registration — at any
          time, here:
        </p>
        <DeleteMyData />
        <p>
          You can also turn off the morning notification in your phone&apos;s settings, and clear what&apos;s saved on your device by clearing
          this site&apos;s data in your browser, or the app&apos;s storage in your phone&apos;s settings. To ask about your data, contact us.
        </p>

        <h2>Children</h2>
        <p>horospaper is not directed at children under 13, and we do not knowingly collect their data.</p>

        <h2>Contact</h2>
        <p>
          Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </GlassCard>
    </main>
  );
}
