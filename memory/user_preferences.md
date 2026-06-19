---
name: user-preferences
description: User coding and collaboration preferences for the bestminton project
metadata:
  type: user
---

- Works in Thai timezone context (badminton team in Thailand, cost displayed in ฿)
- Prefers local testing without server DB setup — IndexedDB first, real DB later via env var
- All features must work end-to-end in both storage modes (IDB local and Postgres prod)
- Dark mode is a requirement; uses `@custom-variant dark (&:where(.dark, .dark *))` TailwindCSS v4 strategy
- Infinity scroll for match lists (PAGE_SIZE=10, IntersectionObserver)
- Guests count toward total headcount on match cards
- Half/full time toggle per player AND per guest, factored into cost split weight formula
