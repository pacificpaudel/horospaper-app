// "Wed 14:05" in the device's own locale/zone -- shown beside the version
// tag so it's obvious at a glance whether the auto-refresh has kicked in.
export function formatRefreshedAt(date: Date): string {
  return date.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
