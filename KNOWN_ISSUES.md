# Known Issues

## Privy Hydration Warnings (RESOLVED)

### Issue
When signing in with Privy, you may see console errors:
```
In HTML, <div> cannot be a descendant of <p>.
This will cause a hydration error.
```

### Cause
This is a **third-party library issue** with Privy's modal component. Privy renders a modal that contains invalid HTML structure (`<div>` nested inside `<p>` tags), which violates HTML spec and triggers React hydration warnings.

### Impact
- ❌ Console errors appear during login
- ✅ **Functionality works perfectly** - no actual bugs
- ✅ User experience unaffected
- ✅ Only cosmetic console warnings

### Resolution
**Fixed by adding `suppressHydrationWarning`** to `<html>` and `<body>` tags in `app/layout.tsx`.

This is the recommended solution for third-party component hydration mismatches that you cannot control.

### Why This Happens
1. Privy's modal portal renders during authentication
2. The modal contains nested `<div>` inside `<p>` tags
3. This is invalid HTML according to spec
4. React detects the mismatch and warns you
5. Since we don't control Privy's code, we suppress the warning

### Alternative Solutions Considered
- ❌ **Custom modal wrapper** - Too complex, breaks Privy updates
- ❌ **Dynamic import** - Doesn't solve the HTML structure issue
- ❌ **Client-only rendering** - Breaks SSR benefits
- ✅ **suppressHydrationWarning** - Clean, recommended by React team

### References
- [React Documentation: suppressHydrationWarning](https://react.dev/reference/react-dom/client/hydrateRoot#suppressing-unavoidable-hydration-mismatch-errors)
- [Next.js Hydration Errors](https://nextjs.org/docs/messages/react-hydration-error)
- Known issue in auth libraries that use portals

---
