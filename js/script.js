// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Header background on scroll
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.classList.add('header--scrolled');
    } else {
        header.classList.remove('header--scrolled');
    }
});

// Animation on scroll
const animatedElements = document.querySelectorAll('.section__title, .about__text, .about__image, .trainer-card, .price-card, .contact-form, .benefit-card');

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, {
    threshold: 0.1
});

animatedElements.forEach(el => {
    observer.observe(el);
});

// Mobile navigation
const burgerMenu = document.querySelector('.burger-menu');
const mobileNav = document.querySelector('.mobile-nav-wrapper');

if (burgerMenu && mobileNav) {
    burgerMenu.addEventListener('click', () => {
        burgerMenu.classList.toggle('is-active');
        mobileNav.classList.toggle('is-open');
    });

    // Close menu when a link is clicked
    mobileNav.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', () => {
            burgerMenu.classList.remove('is-active');
            mobileNav.classList.remove('is-open');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
        if (mobileNav.classList.contains('is-open')) {
            const isClickInsideNav = mobileNav.contains(event.target);
            const isClickOnBurger = burgerMenu.contains(event.target);

            if (!isClickInsideNav && !isClickOnBurger) {
                burgerMenu.classList.remove('is-active');
                mobileNav.classList.remove('is-open');
            }
        }
    });
}
