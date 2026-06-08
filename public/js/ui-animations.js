/**
 * CLASSGRID SHARED UI ANIMATIONS API
 * Handles IntersectionObserver scroll reveals and animated number counters.
 */

const UIAnim = {
    // ── SCROLL REVEALS ──
    initScrollAnimations: () => {
        // Find all elements with the 'reveal' class
        const reveals = document.querySelectorAll('.reveal');
        if (reveals.length === 0) return;

        // Create the observer
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    // Stop observing once revealed to prevent re-animating on scroll up
                    obs.unobserve(entry.target);
                }
            });
        }, {
            root: null, // viewport
            rootMargin: '0px 0px -40px 0px', // trigger slightly before it fully enters bottom
            threshold: 0.1 // 10% visible
        });

        // Observe elements
        reveals.forEach(el => observer.observe(el));
    },

    // ── NUMBER COUNTER ANIMATION ──
    /**
     * Animates a number counting up from start to end.
     * @param {HTMLElement} element - The DOM element holding the number
     * @param {Number} start - The starting number
     * @param {Number} end - The final number
     * @param {Number} duration - Animation duration in ms (default 1200ms)
     * @param {Function} formatter - Optional function to format the output string
     */
    animateValue: (element, start, end, duration = 1200, formatter = (v) => v) => {
        if (!element) return;

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Custom easing: cubic-bezier(0.25, 1, 0.5, 1) equivalent
            // Easing out curve so it slows down at the end
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);

            const currentVal = Math.floor(easeOutQuart * (end - start) + start);
            element.textContent = formatter(currentVal);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = formatter(end); // Ensure exact final value
            }
        };
        window.requestAnimationFrame(step);
    },

    // Helper to trigger counters on a class
    initCounters: (selector = '.anim-counter') => {
        const counters = document.querySelectorAll(selector);
        counters.forEach((counter, index) => {
            // Read target value from dataset or text content. Default to 0 if parsing fails.
            let targetRaw = counter.getAttribute('data-target') || counter.textContent.replace(/[^\d.-]/g, '');
            const target = parseFloat(targetRaw) || 0;

            // Optional format string
            const prefix = counter.getAttribute('data-prefix') || '';
            const suffix = counter.getAttribute('data-suffix') || '';

            // Stagger multiple counters
            const staggerDelay = parseInt(counter.getAttribute('data-stagger') || 0) * 100;

            // Set element initial state
            counter.textContent = prefix + '0' + suffix;

            setTimeout(() => {
                UIAnim.animateValue(counter, 0, target, 1200, (val) => prefix + val.toLocaleString() + suffix);
            }, staggerDelay);
        });
    }
};

// Auto-init on load if desired, but best to call manually after data fetches.
// window.addEventListener('DOMContentLoaded', () => {
//    UIAnim.initScrollAnimations();
// });

window.UIAnim = UIAnim;
