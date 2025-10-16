// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const href = this.getAttribute('href');
        // Проверяем, что href не равен просто "#" и не является javascript:void(0)
        if (href && href !== '#' && href !== 'javascript:void(0)' && href.length > 1) {
            const targetElement = document.querySelector(href);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        }
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

// Trainer cards functionality
document.addEventListener('DOMContentLoaded', function() {
    const trainerBtns = document.querySelectorAll('.trainer-card__btn');
    const trainerModals = document.querySelectorAll('.trainer-modal');
    const modalCloseBtns = document.querySelectorAll('.trainer-modal__close');
    
    // Open modal
    trainerBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            
            if (modal) {
                modal.classList.add('is-open');
                document.body.style.overflow = 'hidden';
            }
        });
    });
    
    // Close modal
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const modal = this.closest('.trainer-modal');
            if (modal) {
                modal.classList.remove('is-open');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close on overlay click
    trainerModals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this || e.target.classList.contains('trainer-modal__overlay')) {
                this.classList.remove('is-open');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.trainer-modal.is-open');
            if (openModal) {
                openModal.classList.remove('is-open');
                document.body.style.overflow = '';
            }
            
            const subscriptionModal = document.querySelector('.subscription-modal.active');
            if (subscriptionModal) {
                subscriptionModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    });
});

// Subscription Modal
document.addEventListener('DOMContentLoaded', function() {
    const subscriptionModal = document.getElementById('subscription-modal');
    const subscriptionModalClose = document.querySelector('.subscription-modal__close');
    const subscriptionButtons = document.querySelectorAll('[data-plan]');
    
    // Open subscription modal
    subscriptionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            subscriptionModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });
    
    // Close subscription modal
    function closeSubscriptionModal() {
        subscriptionModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (subscriptionModalClose) {
        subscriptionModalClose.addEventListener('click', closeSubscriptionModal);
    }
    
    // Close on overlay click
    subscriptionModal.addEventListener('click', function(e) {
        if (e.target === subscriptionModal || e.target.classList.contains('subscription-modal__overlay')) {
            closeSubscriptionModal();
        }
    });
});
