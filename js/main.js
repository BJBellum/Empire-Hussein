/**
 * Empire Hussein — Main JS
 * Handles: letter animation, scroll reveals, header state, smooth scroll, mobile nav
 */

document.addEventListener('DOMContentLoaded', () => {

    // ────────────────────────────────────────
    // 1. LETTER-BY-LETTER HERO ANIMATION
    // ────────────────────────────────────────
    const animateLetters = () => {
        const words = document.querySelectorAll('[data-letter-animate]');
        let globalDelay = 0;
        const BASE_DELAY = 300; // ms before animation starts
        const LETTER_DELAY = 60; // ms between each letter

        words.forEach((word, wordIndex) => {
            const text = word.textContent.trim();
            word.textContent = '';
            word.setAttribute('aria-label', text);

            // Add word delay offset
            if (wordIndex > 0) globalDelay += 150;

            [...text].forEach((char, i) => {
                const span = document.createElement('span');
                span.className = 'letter';
                span.textContent = char === ' ' ? '\u00A0' : char;
                span.style.animationDelay = `${BASE_DELAY + globalDelay + (i * LETTER_DELAY)}ms`;
                word.appendChild(span);
            });

            globalDelay += text.length * LETTER_DELAY;
        });
    };

    animateLetters();

    // ────────────────────────────────────────
    // 2. SCROLL REVEAL (Intersection Observer)
    // ────────────────────────────────────────
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal-up').forEach((el, i) => {
        // Stagger reveal for adjacent elements
        el.style.transitionDelay = `${i % 4 * 100}ms`;
        revealObserver.observe(el);
    });

    // ────────────────────────────────────────
    // 3. HEADER SCROLL STATE
    // ────────────────────────────────────────
    const header = document.getElementById('header');
    let lastScroll = 0;
    let ticking = false;

    const updateHeader = () => {
        const scrollY = window.scrollY;
        if (scrollY > 60) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScroll = scrollY;
        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }, { passive: true });

    // ────────────────────────────────────────
    // 4. SMOOTH SCROLL FOR ANCHOR LINKS
    // ────────────────────────────────────────
    document.querySelectorAll('[data-scroll]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || !href.startsWith('#')) return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (!target) return;

            const headerOffset = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('--header-h')) || 72;

            const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;

            window.scrollTo({ top, behavior: 'smooth' });

            // Close mobile nav if open
            const mobileNav = document.getElementById('mobile-nav');
            const menuToggle = document.getElementById('menu-toggle');
            if (mobileNav && mobileNav.classList.contains('open')) {
                mobileNav.classList.remove('open');
                menuToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // ────────────────────────────────────────
    // 5. MOBILE NAV TOGGLE
    // ────────────────────────────────────────
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');

    if (menuToggle && mobileNav) {
        menuToggle.addEventListener('click', () => {
            const isOpen = mobileNav.classList.toggle('open');
            menuToggle.classList.toggle('active');
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });
    }

    // ────────────────────────────────────────
    // 6. VIDEO FALLBACK
    // ────────────────────────────────────────
    const video = document.querySelector('.hero-video');
    if (video) {
        const handleVideoError = () => {
            const container = document.querySelector('.hero-video-container');
            if (container) {
                container.classList.add('hero-video-container--fallback');
                video.style.display = 'none';
            }
        };

        video.addEventListener('error', handleVideoError);

        // Also check if video can play
        video.addEventListener('loadeddata', () => {
            // Video loaded, good
        });

        // If video source doesn't exist, trigger fallback after a short delay
        const source = video.querySelector('source');
        if (source) {
            source.addEventListener('error', handleVideoError);
        }

        // Fallback timeout: if video hasn't loaded after 5s, show fallback
        setTimeout(() => {
            if (video.readyState === 0) {
                handleVideoError();
            }
        }, 5000);
    }

    // ────────────────────────────────────────
    // 7. PARALLAX-LIKE VIDEO SCROLL
    // ────────────────────────────────────────
    let videoTicking = false;
    const heroSection = document.getElementById('hero');

    if (video && heroSection) {
        window.addEventListener('scroll', () => {
            if (videoTicking) return;
            videoTicking = true;
            requestAnimationFrame(() => {
                const scrollY = window.scrollY;
                const heroHeight = heroSection.offsetHeight;
                if (scrollY < heroHeight) {
                    const offset = scrollY * 0.3;
                    video.style.transform = `translateY(${offset}px) scale(1.05)`;
                }
                videoTicking = false;
            });
        }, { passive: true });
    }

    // ────────────────────────────────────────
    // 8. LOGO LINK — SCROLL TO TOP
    // ────────────────────────────────────────
    const logo = document.querySelector('.logo');

    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ────────────────────────────────────────
    // 9. BATTERY: PAUSE ANIMATIONS
    //    a) Tab hidden → pause everything
    //    b) Hero offscreen → pause hero-only animations (dust, scroll arrow)
    //       so the map section doesn't keep the hero GPU layers alive
    // ────────────────────────────────────────
    const html = document.documentElement;

    document.addEventListener('visibilitychange', () => {
        html.classList.toggle('page-hidden', document.hidden);
    });

    if (heroSection) {
        new IntersectionObserver((entries) => {
            html.classList.toggle('hero-offscreen', !entries[0].isIntersecting);
        }, { threshold: 0 }).observe(heroSection);
    }

    // ────────────────────────────────────────
    // 10. PAGE LOAD CURTAIN
    // ────────────────────────────────────────
    const curtain = document.getElementById('page-curtain');
    if (curtain) {
        // Wait for fonts and critical assets, then reveal
        const revealPage = () => {
            curtain.classList.add('hidden');
            // Remove from DOM after transition
            curtain.addEventListener('transitionend', () => {
                curtain.remove();
            }, { once: true });
        };

        // Reveal after fonts load or max 2s
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => setTimeout(revealPage, 300));
        }
        // Safety timeout
        setTimeout(revealPage, 2500);
    }

    // ────────────────────────────────────────
    // 11. CARD GLOW TRACKING
    // ────────────────────────────────────────
    document.querySelectorAll('.empire-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mouse-x', `${x}%`);
            card.style.setProperty('--mouse-y', `${y}%`);
        });
    });

});
