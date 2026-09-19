---
name: frontend
description: Build, modify, and debug frontend web applications. Use when the user asks for UI/UX work, component creation, styling, responsive design, state management, routing, or frontend tooling setup.
---

# Frontend Skill

Expert guidance and workflows for building modern web frontend applications — from vanilla HTML/CSS/JS to React, Vue, Svelte, and full-stack meta-frameworks.

## Technology Stacks

### Core Technologies
- **HTML5** — semantic markup, accessibility, forms, media elements
- **CSS3** — flexbox, grid, animations, custom properties, container queries
- **JavaScript (ES2023+)** — modules, async/await, destructuring, optional chaining
- **TypeScript** — strict mode, utility types, generics, declaration files

### Frameworks & Libraries
- **React** — hooks, context, custom hooks, React.memo, Suspense
- **Vue 3** — composition API, `<script setup>`, composables
- **Svelte / SvelteKit** — runes, stores, transitions
- **Next.js** — App Router, Server Components, SSR/SSG
- **Tailwind CSS** — utility-first, JIT compiler, design tokens
- **Shadcn/ui** — copy-paste components built on Radix + Tailwind

### State Management
- **React**: Zustand, Jotai, Valtio (lightweight); Redux Toolkit (complex); React Query (server state)
- **Vue**: Pinia, VueUse composables
- **Cross-framework**: TanStack Query, RxJS

### Build & Dev Tools
- **Vite** — preferred dev server and bundler (fast HMR, rollup-based builds)
- **ESLint + Prettier** — consistent code style
- **Vitest / Playwright** — unit and E2E testing
- **Storybook** — component documentation and isolated development

## Workflows

### New Component Creation
```
1. Identify component purpose, props interface, and state requirements
2. Choose: single-file component or folder with index + styles + test + stories
3. Write the TypeScript interface / prop types first
4. Implement the component with accessibility in mind (ARIA labels, keyboard nav)
5. Add unit tests (render, interactions, edge cases)
6. Add Storybook story if applicable
7. Verify responsive behavior at common breakpoints
```

### Styling Strategy Decision Tree
```
- Rapid MVP / admin dashboards → Tailwind CSS
- Design-system-heavy / multiple themes → CSS Modules + CSS custom properties
- Component library / shared across teams → CSS-in-JS (styled-components) or vanilla extract
- Existing large codebase → match existing approach
```

### Debugging Frontend Issues
```
1. Reproduce in browser DevTools (Elements, Console, Network, Performance)
2. Check for hydration mismatches (Next.js: disable SSR temporarily)
3. Verify data fetching — is the server returning what you expect?
4. Check CSS specificity and computed styles
5. Use React DevTools / Vue DevTools for component state inspection
6. For performance: Lighthouse audit, Chrome Performance tab
```

### Responsive Design Checklist
- Mobile-first CSS (min-width media queries)
- Touch targets ≥ 44×44px
- Viewport meta tag present
- Images use `srcset` or responsive sizing
- Typography scales with `clamp()` or fluid type
- Test: 320px, 768px, 1024px, 1440px+ viewports

### Accessibility (a11y) Checklist
- Semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<article>`)
- All images have meaningful `alt` text
- Color contrast ≥ 4.5:1 for normal text
- Keyboard-navigable interactive elements
- Focus indicators visible
- ARIA labels only when native semantics insufficient
- Test with screen reader (NVDA, VoiceOver)

## Common Patterns

### "Create a landing page"
```
1. Ask: framework? (React/Vue/vanilla) + styling approach? (Tailwind/CSS Modules)
2. Set up page structure: Hero → Features → Testimonials → CTA → Footer
3. Implement each section as a component with responsive breakpoints
4. Add scroll animations (IntersectionObserver or Framer Motion)
5. Optimize images (Next.js Image, lazy loading, WebP/AVIF)
6. SEO: meta tags, OpenGraph, structured data
```

### "Add a form with validation"
```
1. Choose: React Hook Form + Zod, or VeeValidate + Yup (Vue), or native + constraint validation
2. Define schema with validation rules
3. Build form UI with accessible labels and error messages
4. Handle submission states (idle / loading / success / error)
5. Show field-level errors inline, form-level errors at top
```

### "Fix a layout bug"
```
1. Inspect element in DevTools → check computed styles
2. Verify parent has defined dimensions (flex/grid container? width/height?)
3. Check for margin collapse, overflow, or z-index stacking
4. Verify media queries aren't overriding unexpectedly
5. Check if CSS is being purged (Tailwind: safelist, CSS Modules: import)
```

### "Set up a new frontend project"
```
1. Choose starter: Vite (recommended), Next.js (SSR needed), or framework-specific CLI
2. Add TypeScript configuration (strict mode)
3. Add ESLint + Prettier config
4. Add Tailwind or preferred styling solution
5. Set up folder structure (components/, pages/, hooks/, utils/, types/)
6. Add testing framework (Vitest + React Testing Library / Vue Test Utils)
7. Configure CI (GitHub Actions: lint, test, build)
```

## Integration with Backend

- Use environment variables for API base URLs (`VITE_API_URL`, `NEXT_PUBLIC_API_URL`)
- Implement API client layer (fetch wrapper or axios with interceptors)
- Handle auth tokens (httpOnly cookies preferred; localStorage only for non-sensitive)
- Implement loading skeletons and error boundaries for graceful degradation
- Use TanStack Query for caching, deduping, and background refetching

## Performance Rules

- Bundle size: analyze with `vite-bundle-visualizer` or `@next/bundle-analyzer`
- Lazy load routes and heavy components (`React.lazy`, `defineAsyncComponent`)
- Images: WebP/AVIF, `loading="lazy"`, proper `width`/`height` to prevent CLS
- Fonts: `font-display: swap`, preload critical fonts, subset if possible
- Minimize layout shifts: reserve space for dynamic content
- Use `will-change` sparingly; prefer `transform` and `opacity` for animations

## Notes

- Prefer composition over inheritance in component design
- Keep components focused: one responsibility, props over deep nesting
- Extract reusable logic into custom hooks / composables
- When in doubt, start simple — add abstraction only when duplication appears
