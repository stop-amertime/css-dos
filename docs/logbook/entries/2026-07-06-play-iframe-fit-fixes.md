# 2026-07-06 — Play iframe: fit-to-content race + colour blend

Owner report: the embedded player was tall again (big gray band under
the keyboard), blue shadow ugly, embed gray didn't match the site
window. Two real bugs in the 2026-07-06 fit-to-content sizing:
(1) the measure hooked only the iframe 'load' event — a cached/
SW-served document finishes before the Svelte action attaches, so the
frame sat on the CSS fallback height forever (now: also measure when
readyState==='complete'); (2) the ResizeObserver was created by the
PARENT window watching the child document's body — Chrome doesn't
deliver those; at phone width the content reflowed 608→421px and the
frame never followed (now: observer is created via
frame.contentWindow.ResizeObserver, re-created per load, plus a parent
window-resize fallback). Cosmetics: .inline-player blue box-shadow
dropped, background → site gray; the player's #embed mode paints body
+ window in the SITE's dialog gray #d6d6d6 (not its own EGA #aaaaaa) so
the iframe is invisible against the host window — separate documents,
no shared var, value mirrored by comment. raw.html regenerated.
Verified: 610px at desktop / 423px at 390w, both = content+2; grows
and shrinks live on resize; note visible, wizard scroll = 0.
