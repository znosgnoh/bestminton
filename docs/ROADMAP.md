# Bestminton — Feature Roadmap

Backlog of potential next features, roughly ordered by value. None are committed — use this as a starting point for story generation.

---

## Near-term

### US-33: Captain PIN for Management Page — **shipped**

`CAPTAIN_PIN` (or legacy `ADMIN_PIN`) gates `/management` via `ManagementGate` and protects captain mutating APIs (members, matches, settlement, Splitwise, avatar upload, challenge admin). PIN is sent from the client via JSON `pin` or `X-Captain-Pin` after unlock. Unset env var = no gate (dev convenience). See `CLAUDE.md` §8–9.

---

### US-34: Share Match Link

On the match detail page, a **Share** button copies the match URL to the clipboard (or triggers the native Web Share API on mobile). Makes it easy for the captain to distribute the registration link to the team via Line / WhatsApp.

**Acceptance criteria sketch:**

- Button visible on both upcoming and past match pages.
- On browsers with `navigator.share`, uses native sheet; otherwise copies to clipboard and shows a brief "Copied!" confirmation.

---

### US-35: Match Cancellation

Allow the captain to cancel a scheduled match from `/management`. A cancelled match is hidden from the homepage upcoming tab and marked with a "Cancelled" badge in management.

**Acceptance criteria sketch:**

- Cancel button on upcoming match rows in management (alongside edit/delete).
- Confirmation dialog before cancelling.
- Cancelled matches are visually distinct and excluded from the homepage.
- Cancellation is reversible (restore button) until the match date passes.

---

## Medium-term

### US-36: Player Attendance Statistics

A stats view per member: total matches attended, total amount owed across settled matches, attendance rate. Accessible from the member card in `/management`.

---

### US-37: Recurring Match Auto-Advance

When the last auto-generated instance of a recurring match is registered or passes, automatically generate the next one. Currently the system generates 8 weeks upfront at creation time; this would keep the series rolling indefinitely.

---

### US-38: Cost History Export

From a past settled match, allow the captain to export the cost breakdown as a simple CSV or copy a formatted text summary (ready to paste into a Line group message).

---

## Longer-term

### US-39: Push Notifications / Reminders

Send a reminder to registered players N hours before a match starts. Requires a notification delivery mechanism (email via Resend, or Line Notify API).

### US-40: Multiple Groups / Teams

Support multiple badminton groups within one app instance, each with their own member list, matches, and Splitwise group. Useful if the same captain manages more than one team.

### US-41: Photo / Proof of Payment Upload

Allow the captain to attach a court receipt photo to a settled match, stored in Vercel Blob, visible to all players on the match detail page.
