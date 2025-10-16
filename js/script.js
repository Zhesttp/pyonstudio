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

// Contact form handling
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            // Show loading state
            submitButton.textContent = 'Отправляем...';
            submitButton.disabled = true;
            
            try {
                const formData = new FormData(this);
                const data = {
                    name: formData.get('name'),
                    phone: formData.get('phone'),
                    message: formData.get('message')
                };
                
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
                    },
                    credentials: 'include',
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Show success message
                    showNotification('Сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.', 'success');
                    this.reset();
                } else {
                    // Show error message with validation details
                    let errorMessage = result.message || 'Произошла ошибка при отправке сообщения';
                    if (result.errors && result.errors.length > 0) {
                        const firstError = result.errors[0];
                        if (firstError.param === 'message') {
                            errorMessage = 'Сообщение слишком короткое. Пожалуйста, напишите более подробно.';
                        } else if (firstError.param === 'phone') {
                            errorMessage = 'Пожалуйста, введите корректный номер телефона.';
                        } else if (firstError.param === 'name') {
                            errorMessage = 'Пожалуйста, введите корректное имя.';
                        }
                    }
                    showNotification(errorMessage, 'error');
                }
                
            } catch (error) {
                console.error('Contact form error:', error);
                showNotification('Произошла ошибка при отправке сообщения. Попробуйте позже.', 'error');
            } finally {
                // Reset button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});

// Helper function to get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.innerHTML = `
        <div class="notification__content">
            <span class="notification__message">${message}</span>
            <button class="notification__close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .notification__content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .notification__close {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .notification__close:hover {
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification__close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}
