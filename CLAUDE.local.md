# Frontend Styling Rules

Stack assumption: React + Tailwind CSS. Clean, standardized, scale-based styling only.

## 0. Golden rule
Use the design system's scale. Never invent one-off values. If it isn't on the Tailwind scale or a named theme token, it doesn't go in the code.

## 1. Forbidden (hard rules)
- NO arbitrary values: `bg-[#123456]`, `text-[200px]`, `w-[200px]`, `p-[13px]`, `mt-[37px]`, `rounded-[7px]`, `grid-cols-[...]`, `z-[999]`.
- NO inline `style={{ }}` for color, spacing, sizing, or layout. (Only allowed for truly dynamic runtime values, e.g. a progress bar width from data, and use a CSS variable where possible.)
- NO hex / rgb / hsl values in components.
- NO `!important` or `!` Tailwind modifiers to win specificity fights. Fix the structure instead.
- NO fixed pixel widths/heights for layout. NO pixel-nudged absolute positioning.
- NO magic z-index numbers. Use `z-0 z-10 z-20 z-30 z-40 z-50` only.
- NO new custom CSS classes for things Tailwind already does.
- NO margin hacks on children to space siblings (see Layout).

## 2. If a value isn't on the scale
1. Pick the nearest scale value. This is almost always the right call.
2. If it is a repeated brand value (brand color, custom font, custom breakpoint), define it ONCE in the theme (`tailwind.config.js` or `@theme` in CSS) as a named token, then use the token: `bg-brand`, not `bg-[#0a5]`.
3. If neither works, stop and ask. Do not improvise.

## 3. Layout
- One-dimensional layout (row or column): `flex`, `flex-col`, `items-*`, `justify-*`, `gap-*`.
- Two-dimensional layout (rows and columns): `grid`, `grid-cols-*`, `gap-*`.
- Spacing between siblings: `gap-*` on the parent, or `space-x-*` / `space-y-*`. Not `mt-*` on each child.
- Centering: `flex items-center justify-center` or `grid place-items-center`.
- Sizing: `w-full`, `max-w-*` (`max-w-md`, `max-w-screen-lg`), `flex-1`, `shrink-0`, `min-w-0`, `aspect-video`, `aspect-square`, `h-full`, `min-h-screen`. Let content and containers decide size.
- Page container pattern: `mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8`.
- Use `absolute`/`fixed`/`sticky` only for overlays, modals, dropdowns, tooltips, and sticky headers. Pair with `inset-*`, never pixel offsets.
- Truncation: `truncate`, `line-clamp-*`. Overflow: `overflow-auto`, `overflow-hidden`.

## 4. Responsiveness
- Mobile-first. Write base styles for mobile, then layer `sm:` `md:` `lg:` `xl:`.
- Prefer layout that adapts on its own: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `flex-col md:flex-row`, `flex-wrap`.
- Do not hide content with `hidden` at one breakpoint just to build a second duplicate layout, unless truly necessary.

## 5. Typography
- Sizes: `text-xs sm base lg xl 2xl 3xl 4xl` only. Weights: `font-normal font-medium font-semibold font-bold`.
- Line height / tracking: `leading-*`, `tracking-*` from the scale.
- Establish a hierarchy and reuse it (page title, section title, body, caption). Same role = same classes everywhere.

## 6. Color
- Use semantic palette steps: `text-gray-700`, `bg-slate-50`, `border-gray-200`, `bg-blue-600 hover:bg-blue-700`.
- Prefer theme tokens for brand and semantic colors (`bg-primary`, `text-muted`, `border-border`) if the project defines them.
- Stick to one neutral family (gray OR slate OR zinc) across the whole app.
- Dark mode: use `dark:` variants only if the project already supports it.
- Check contrast: body text on a background should be readable (e.g. `text-gray-700` on white, not `text-gray-400`).

## 7. Spacing, radius, shadow, borders
- Spacing: Tailwind scale only (`1 2 3 4 5 6 8 10 12 16 ...`). Prefer an even rhythm: `gap-4`, `p-4`, `p-6`, `py-8`.
- Radius: `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`. Pick one per component type and stay consistent.
- Shadows: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`.
- Borders: `border`, `border-gray-200`, `divide-y`.

## 8. States and interaction
- Always style: `hover:`, `focus-visible:`, `disabled:`, and `aria-*` / `data-*` states where relevant.
- Focus must be visible: `focus-visible:ring-2 focus-visible:ring-offset-2`.
- Transitions: `transition` / `transition-colors` with `duration-150` or `duration-200`.
- Interactive elements use real elements (`button`, `a`, `input`), not styled `div`s.

## 9. Components and reuse
- Look at existing components and patterns before writing new markup. Match them.
- If the same class combination appears 3+ times, extract a component (not a custom CSS class). Variants via props, optionally with `cva` / `tailwind-merge` / `clsx` if already in the project.
- Keep components small and composable. No giant className strings: if it exceeds roughly 10 to 12 utilities, consider splitting the element or extracting a component.
- Class order: layout, sizing, spacing, typography, color, effects, state/responsive variants. Use `prettier-plugin-tailwindcss` ordering if installed.

## 10. Shared UI components (reuse, never duplicate)
Every recurring piece of UI must exist exactly ONCE as a shared component and be reused everywhere. This applies to (not limited to):
- **Sidebar**, **Navbar / Header**, **Footer**
- **Card** (and its parts: CardHeader, CardBody, CardFooter)
- **Button**, **Input**, **Select**, **Textarea**, **Checkbox**, **Badge**
- **Modal / Dialog**, **Dropdown**, **Tooltip**, **Tabs**
- **Table**, **List item**, **Empty state**, **Loading spinner / skeleton**, **Alert / Toast**
- **Page layout / PageContainer** and **Section heading**

Rules:
- BEFORE creating any UI element, search the codebase for an existing component (check `components/`, `ui/`, `layouts/`). If one exists, use it. Do NOT write a new one or copy-paste its markup.
- NEVER hand-write a one-off sidebar, navbar, or card inside a page. Pages compose shared components; they don't define their own versions.
- If an existing component almost fits, extend it with a prop or variant (`variant`, `size`, `as`, `className` passthrough). Do not fork it.
- If no component exists yet, create ONE in the shared components folder, then use it. Do not define it inline inside a page file.
- Layout components (Sidebar, Navbar, PageLayout) live in a shared layout, so every page gets the same shell. Pages only render their own content inside it.
- Same role = same component = same look across the whole app. A card on the dashboard and a card on the settings page must come from the same Card component.
- Use `children` and named slots/props for content. Do not hardcode page-specific text or data inside shared components.
- Keep props simple and typed. Prefer a few well-named variants over many boolean flags.
- When you change a shared component, check where else it's used and make sure nothing breaks.
- Do not duplicate class strings across files. If you copy the same set of utilities a second time, extract a component instead.

Example:

Bad: each page builds its own card.
```jsx
// DashboardPage.jsx
<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">...</div>
// SettingsPage.jsx
<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">...</div>
```

Good: one Card, reused.
```jsx
// components/ui/Card.jsx defines the styles once
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>...</CardBody>
</Card>
```

## 11. Accessibility
- Semantic HTML first (`nav`, `main`, `section`, `header`, `footer`, `ul/li`, `button`).
- Every `img` has meaningful `alt` (or `alt=""` if decorative). Every input has a label.
- Never rely on color alone to convey meaning.

## 12. Good vs bad

Bad:
```jsx
<div style={{ width: 200, marginTop: 13 }} className="bg-[#123456] text-[20px] w-[200px]">
  <div className="mt-[10px]">A</div>
  <div className="mt-[10px]">B</div>
</div>
```

Good:
```jsx
<div className="flex w-full max-w-xs flex-col gap-2 bg-slate-800 p-4 text-xl text-white">
  <div>A</div>
  <div>B</div>
</div>
```

Bad: fixed 3-column layout with pixel widths.
```jsx
<div className="flex"><div className="w-[300px]" /><div className="w-[300px]" /><div className="w-[300px]" /></div>
```

Good: responsive grid.
```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">...</div>
```

## 13. Before you say you're done (checklist)
0. Confirm you reused existing shared components (Sidebar, Navbar, Card, Button, etc.) instead of writing new copies. If you created a new one, it lives in the shared components folder and is used by every place that needs it.
1. Search your changes for `-[`, `style=`, `#` color codes, `!important`. Replace any hits with scale values or theme tokens.
2. Confirm layout uses flex/grid + gap, with no fixed pixel sizing.
3. Confirm it works at mobile width and desktop width.
4. Run the project's lint and format commands and fix all issues.
5. Briefly list any place where you had to deviate from these rules and why.
