/**
 * Classgrid SPA Router — Lightweight client-side router
 * Intercepts navigation between SPA-enabled pages and swaps content
 * without a full page reload. Falls back to normal navigation for
 * non-SPA routes or on any error.
 *
 * SPA-enabled routes: /classroom, /view-classroom, /settings
 *
 * Android WebView compatibility:
 * - Uses history.pushState() for every navigation (never replaceState for navigations)
 * - Maintains a manual history stack so popstate always knows where to go back
 * - Exposes window.__spaHistoryLength for native Android code to check
 */
(function () {
    'use strict';

    // ── CONFIG ──────────────────────────────────────────────────
    const SPA_ROUTES = [
        '/classroom',
        '/classroom.html',
        '/view-classroom',
        '/view-classroom.html',
        '/settings',
        '/settings.html'
    ];

    // Map clean routes to their .html file equivalents
    const ROUTE_MAP = {
        '/classroom': '/classroom.html',
        '/view-classroom': '/view-classroom.html',
        '/settings': '/settings.html'
    };

    let isNavigating = false;
    let currentAbortController = null;

    // ── HISTORY STACK (for Android WebView) ─────────────────────
    // Android WebView's canGoBack() sometimes fails with pushState-only history.
    // We maintain our own stack so we always know the correct previous URL.
    const historyStack = [window.location.pathname + window.location.search];

    // Expose for native Android code (optional — can check from Java/Kotlin)
    Object.defineProperty(window, '__spaHistoryLength', {
        get: function () { return historyStack.length; }
    });

    // ── PROGRESS BAR ────────────────────────────────────────────
    function createProgressBar() {
        if (document.getElementById('spa-progress')) return;
        const bar = document.createElement('div');
        bar.id = 'spa-progress';
        bar.innerHTML = '<div class="spa-progress-fill"></div>';
        const style = document.createElement('style');
        style.textContent = `
            #spa-progress {
                position: fixed; top: 0; left: 0; width: 100%;
                height: 3px; z-index: 99999; pointer-events: none;
                opacity: 0; transition: opacity 0.2s;
            }
            #spa-progress.active { opacity: 1; }
            .spa-progress-fill {
                height: 100%; width: 0%;
                background: linear-gradient(90deg, #00d4ff, #a855f7, #ec4899);
                border-radius: 0 2px 2px 0;
                transition: width 0.3s ease;
                box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(bar);
    }

    function showProgress(percent) {
        const bar = document.getElementById('spa-progress');
        if (!bar) return;
        bar.classList.add('active');
        bar.querySelector('.spa-progress-fill').style.width = percent + '%';
    }

    function hideProgress() {
        const bar = document.getElementById('spa-progress');
        if (!bar) return;
        bar.querySelector('.spa-progress-fill').style.width = '100%';
        setTimeout(() => {
            bar.classList.remove('active');
            bar.querySelector('.spa-progress-fill').style.width = '0%';
        }, 300);
    }

    // ── ROUTE MATCHING ──────────────────────────────────────────
    function isSpaRoute(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            const path = parsed.pathname.replace(/\/$/, '') || '/';
            return SPA_ROUTES.some(route => path === route || path === route.replace('.html', ''));
        } catch {
            return false;
        }
    }

    function resolveHtmlPath(url) {
        const parsed = new URL(url, window.location.origin);
        let path = parsed.pathname;
        // If the path doesn't end with .html, map it
        if (!path.endsWith('.html')) {
            path = ROUTE_MAP[path] || path + '.html';
        }
        return path + parsed.search + parsed.hash;
    }

    // ── CORE NAVIGATION ─────────────────────────────────────────
    async function navigate(url, pushState = true) {
        if (isNavigating) {
            // Abort the previous navigation
            if (currentAbortController) currentAbortController.abort();
        }

        const fullUrl = new URL(url, window.location.origin);
        const htmlPath = resolveHtmlPath(url);

        // Don't SPA-navigate to the same page (let browser handle hash changes etc.)
        if (fullUrl.pathname === window.location.pathname && fullUrl.search === window.location.search) {
            return;
        }

        isNavigating = true;
        currentAbortController = new AbortController();
        createProgressBar();
        showProgress(20);

        try {
            // Fetch the target page
            const response = await fetch(htmlPath, {
                signal: currentAbortController.signal,
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-store'
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            showProgress(60);

            const html = await response.text();
            showProgress(80);

            // Parse the fetched HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // ── Cleanup: stop any running intervals/timeouts, speech, etc.
            cleanupCurrentPage();

            // ── Extract and apply <title>
            const newTitle = doc.querySelector('title')?.textContent || 'Classgrid';
            document.title = newTitle;

            // ── Extract styles from new page's <head>
            const newStyles = doc.querySelectorAll('head style');
            // Remove old SPA-injected styles
            document.querySelectorAll('style[data-spa-injected]').forEach(s => s.remove());

            newStyles.forEach(style => {
                const clone = style.cloneNode(true);
                clone.setAttribute('data-spa-injected', 'true');
                document.head.appendChild(clone);
            });

            // ── Extract and inject <link> stylesheets from new page that aren't already loaded
            const existingLinks = new Set(
                [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href)
            );
            doc.querySelectorAll('head link[rel="stylesheet"]').forEach(link => {
                if (!existingLinks.has(link.href)) {
                    const clone = link.cloneNode(true);
                    clone.setAttribute('data-spa-injected', 'true');
                    document.head.appendChild(clone);
                }
            });

            // ── Swap body content
            // Preserve the progress bar
            const progressBar = document.getElementById('spa-progress');
            document.body.innerHTML = doc.body.innerHTML;
            if (progressBar) document.body.appendChild(progressBar);

            // Copy body classes/attributes
            document.body.className = doc.body.className;
            if (doc.body.dataset.theme) {
                document.documentElement.dataset.theme = doc.body.dataset.theme;
            } else if (doc.documentElement.dataset.theme) {
                document.documentElement.dataset.theme = doc.documentElement.dataset.theme;
            }

            // ── Update URL and history
            if (pushState) {
                const displayUrl = fullUrl.pathname + fullUrl.search + fullUrl.hash;
                // ALWAYS use pushState (never replaceState) for forward navigation.
                // This ensures Android WebView's native back stack (canGoBack()) is updated.
                const stateObj = {
                    spa: true,
                    url: displayUrl,
                    stackIndex: historyStack.length
                };
                history.pushState(stateObj, newTitle, displayUrl);

                // Track in our own stack
                historyStack.push(displayUrl);
            }

            showProgress(90);

            // ── Execute scripts from the new body
            // Auth guard script in <head> is NOT re-executed (user is already authed)
            const bodyScripts = doc.querySelectorAll('body script');
            await executeScripts(bodyScripts);

            // Also execute head scripts that are NOT the auth guard (e.g., app-state.js)
            const headScripts = doc.querySelectorAll('head script[src]');
            for (const script of headScripts) {
                if (script.src && !script.textContent.includes('Auth Guard')) {
                    // Skip if already loaded
                    const src = script.getAttribute('src');
                    if (!document.querySelector(`script[src="${src}"]`)) {
                        await loadScript(src);
                    }
                }
            }

            hideProgress();
            window.scrollTo(0, 0);

        } catch (err) {
            if (err.name === 'AbortError') {
                // Navigation was cancelled by a new navigation — ignore
                return;
            }
            console.warn('[SPA Router] Navigation failed, falling back:', err);
            // Fallback: do a normal page load
            window.location.href = url;
        } finally {
            isNavigating = false;
            currentAbortController = null;
        }
    }

    // ── SCRIPT EXECUTION ────────────────────────────────────────
    function executeScripts(scripts) {
        return new Promise((resolve) => {
            const scriptArray = [...scripts];
            let index = 0;

            function next() {
                if (index >= scriptArray.length) {
                    resolve();
                    return;
                }

                const oldScript = scriptArray[index++];
                const newScript = document.createElement('script');

                // Copy attributes
                [...oldScript.attributes].forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });

                if (oldScript.src) {
                    // External script — load and wait
                    newScript.onload = next;
                    newScript.onerror = next;
                    document.body.appendChild(newScript);
                } else {
                    // Inline script — execute immediately
                    newScript.textContent = oldScript.textContent;
                    document.body.appendChild(newScript);
                    next();
                }
            }

            next();
        });
    }

    function loadScript(src) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    }

    // ── CLEANUP ─────────────────────────────────────────────────
    function cleanupCurrentPage() {
        // Stop speech synthesis if running
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Cancel any pending notification refresh intervals
        // (view-classroom.html uses ATT_REFRESH, ATT_TIMER)
        // We clear all intervals to be safe — new page will set its own
        const maxId = window.setTimeout(() => { }, 0);
        for (let i = 0; i < maxId; i++) {
            window.clearTimeout(i);
            window.clearInterval(i);
        }

        // Close any open modals
        document.body.classList.remove('modal-open');

        // Remove Supabase realtime subscriptions if any
        // (These are re-created by the new page's init)
    }

    // ── EVENT LISTENERS ─────────────────────────────────────────

    // Intercept link clicks
    document.addEventListener('click', (e) => {
        // Find the closest <a> tag
        const anchor = e.target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        // Skip special links
        if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;

        // Check if it's a SPA-enabled route
        const fullUrl = new URL(href, window.location.origin);
        if (fullUrl.origin !== window.location.origin) return;

        if (isSpaRoute(href)) {
            e.preventDefault();
            navigate(href);
        }
    }, true);

    // Handle browser back/forward (and Android hardware back button)
    window.addEventListener('popstate', (e) => {
        // When Android WebView calls webView.goBack(), it triggers popstate.
        // We need to load the correct page for the URL we're now at.
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;

        // Update our stack: pop the last entry if going back
        if (historyStack.length > 1) {
            const lastEntry = historyStack[historyStack.length - 1];
            const currentPath = window.location.pathname + window.location.search;
            // If we went back, pop the stack
            if (lastEntry !== currentPath) {
                historyStack.pop();
            }
        }

        if (isSpaRoute(window.location.href)) {
            navigate(currentUrl, false);
        }
        // For non-SPA routes, the browser handles it normally (full page load)
    });

    // ── PUBLIC API ───────────────────────────────────────────────
    window.SpaRouter = {
        navigate: navigate,
        isSpaRoute: isSpaRoute,
        getHistoryLength: function () { return historyStack.length; }
    };

    // ── INITIAL STATE ───────────────────────────────────────────
    // Mark the initial page in the browser's history state so we know it's SPA-managed
    if (!window.history.state || !window.history.state.spa) {
        history.replaceState(
            { spa: true, url: window.location.pathname + window.location.search, stackIndex: 0 },
            document.title,
            window.location.href
        );
    }

    // Create progress bar on initial page load
    createProgressBar();

    console.log('[SPA Router] Initialized — intercepting routes:', SPA_ROUTES.join(', '));
})();
