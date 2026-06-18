# Project Rules

1. **Architecture & Framework:**
   - Use ONLY Next.js App Router (`app/` directory). DO NOT use the Pages router.
   - Maximize the use of Server Components. Only use Client Components (`"use client"`) when UI interactivity is strictly required (e.g., forms, state hooks, onClick events).

2. **Styling:**
   - Use ONLY TailwindCSS. Do not write custom CSS files except for `globals.css`.
   - Prioritize a Mobile-first UI (since the app will be primarily used on mobile devices at the badminton court). The interface should be clean with large, touch-friendly inputs and buttons.

3. **TypeScript & Types:**
   - 100% of the code must use TypeScript. Avoid using `any`. Clearly define interfaces/types for Splitwise Member, form states, and the Splitwise Expense Payload.

4. **API & Security:**
   - DO NOT hardcode the API Key on the frontend. Store the Splitwise API Key in the `.env.local` file (e.g., `SPLITWISE_API_KEY`).
   - Handle errors gracefully in the API Route, returning standard HTTP status codes (400, 500) and clear JSON error messages so the frontend can display Toast notifications.