// Terms of Service Management
class TermsManager {
    constructor() {
        this.termsModal = document.getElementById('terms-modal');
        this.privacyModal = document.getElementById('privacy-modal');
        this.cookiesModal = document.getElementById('cookies-modal');
        this.termsBanner = document.getElementById('terms-banner');
        this.cookieName = 'pyon_terms_accepted';
        this.cookieExpiry = 365; // days
        
        // Инициализируем только если есть необходимые элементы
        if (this.termsModal || this.termsBanner) {
            this.init();
        }
    }

    init() {
        // Check if user has already accepted terms
        if (!this.hasAcceptedTerms() && this.termsBanner) {
            this.showTermsBanner();
        }
        
        this.bindEvents();
    }

    hasAcceptedTerms() {
        return this.getCookie(this.cookieName) === 'true';
    }

    setTermsAccepted(accepted) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (this.cookieExpiry * 24 * 60 * 60 * 1000));
        document.cookie = `${this.cookieName}=${accepted}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    showTermsBanner() {
        if (!this.termsBanner) {
            console.warn('Terms banner not found, cannot show banner');
            return;
        }
        
        setTimeout(() => {
            this.termsBanner.style.display = 'block';
            // Force reflow
            this.termsBanner.offsetHeight;
            this.termsBanner.classList.add('is-visible', 'slide-up');
        }, 1000); // Show banner after 1 second
    }

    hideTermsBanner() {
        if (!this.termsBanner) {
            return;
        }
        
        this.termsBanner.classList.remove('is-visible');
        setTimeout(() => {
            this.termsBanner.style.display = 'none';
        }, 300);
    }

    showTermsModal() {
        if (!this.termsModal) {
            return;
        }
        
        this.termsModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        const closeBtn = this.termsModal.querySelector('.terms-modal__close');
        if (closeBtn) {
            closeBtn.focus();
        }
    }

    hideTermsModal() {
        if (!this.termsModal) {
            return;
        }
        
        this.termsModal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    showPrivacyModal() {
        if (!this.privacyModal) {
            return;
        }
        
        this.privacyModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        const closeBtn = this.privacyModal.querySelector('.terms-modal__close');
        if (closeBtn) {
            closeBtn.focus();
        }
    }

    hidePrivacyModal() {
        if (!this.privacyModal) {
            return;
        }
        
        this.privacyModal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    showCookiesModal() {
        if (!this.cookiesModal) {
            return;
        }
        
        this.cookiesModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        const closeBtn = this.cookiesModal.querySelector('.terms-modal__close');
        if (closeBtn) {
            closeBtn.focus();
        }
    }

    hideCookiesModal() {
        if (!this.cookiesModal) {
            return;
        }
        
        this.cookiesModal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    acceptTerms() {
        this.setTermsAccepted(true);
        this.hideTermsBanner();
        this.hideTermsModal();
        
        // Optional: Track acceptance for analytics
        this.trackTermsAcceptance();
    }

    declineTerms() {
        this.setTermsAccepted(false);
        this.hideTermsBanner();
        this.hideTermsModal();
        
        // Optional: Show alternative message or redirect
        this.showDeclineMessage();
    }

    trackTermsAcceptance() {
        // Optional: Send analytics event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'terms_accepted', {
                event_category: 'legal',
                event_label: 'user_agreement'
            });
        }
        
        // Optional: Send to your analytics service
        console.log('Terms accepted by user');
    }

    showDeclineMessage() {
        // Optional: Show a message about limited functionality
        const message = document.createElement('div');
        message.className = 'decline-message';
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 10001;
                max-width: 300px;
                font-size: 14px;
                color: #856404;
            ">
                <strong>Ограниченный доступ</strong><br>
                Некоторые функции сайта могут быть недоступны без принятия условий использования.
                <button onclick="this.parentElement.remove()" style="
                    background: none;
                    border: none;
                    float: right;
                    font-size: 18px;
                    cursor: pointer;
                    color: #856404;
                    margin-top: -4px;
                ">&times;</button>
            </div>
        `;
        document.body.appendChild(message);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (message.parentElement) {
                message.remove();
            }
        }, 5000);
    }

    bindEvents() {
        // Banner events
        const acceptBannerBtn = document.getElementById('accept-banner');
        const declineBannerBtn = document.getElementById('decline-banner');
        const readTermsLink = document.getElementById('read-terms-link');

        if (acceptBannerBtn) {
            acceptBannerBtn.addEventListener('click', () => {
                this.acceptTerms();
            });
        }

        if (declineBannerBtn) {
            declineBannerBtn.addEventListener('click', () => {
                this.declineTerms();
            });
        }

        if (readTermsLink) {
            readTermsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTermsModal();
            });
        }

        // Modal events
        const acceptTermsBtn = document.getElementById('accept-terms');
        const declineTermsBtn = document.getElementById('decline-terms');
        const closeModalBtn = this.termsModal?.querySelector('.terms-modal__close');

        if (acceptTermsBtn) {
            acceptTermsBtn.addEventListener('click', () => {
                this.acceptTerms();
            });
        }

        if (declineTermsBtn) {
            declineTermsBtn.addEventListener('click', () => {
                this.declineTerms();
            });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.hideTermsModal();
            });
        }

        // Close modal on overlay click
        if (this.termsModal) {
            this.termsModal.addEventListener('click', (e) => {
                if (e.target === this.termsModal || e.target.classList.contains('terms-modal__overlay')) {
                    this.hideTermsModal();
                }
            });
        }

        // Close modal on Escape key and handle keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.termsModal?.classList.contains('is-open')) {
                this.hideTermsModal();
            }
            
            // Handle keyboard scrolling in modal
            if (this.termsModal?.classList.contains('is-open')) {
                const modalBody = this.termsModal.querySelector('.terms-modal__body');
                if (modalBody && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) {
                    e.preventDefault();
                    const scrollAmount = e.key === 'ArrowDown' ? 50 : e.key === 'ArrowUp' ? -50 : e.key === 'PageDown' ? 200 : -200;
                    modalBody.scrollBy(0, scrollAmount);
                }
            }
        });

        // Handle links in terms modal
        const privacyPolicyLink = document.getElementById('privacy-policy-link');
        const privacyPolicyFullLink = document.getElementById('privacy-policy-full-link');
        const cookiesPolicyLink = document.getElementById('cookies-policy-link');

        if (privacyPolicyLink) {
            privacyPolicyLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideTermsModal();
                this.showPrivacyModal();
            });
        }

        if (privacyPolicyFullLink) {
            privacyPolicyFullLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideTermsModal();
                this.showPrivacyModal();
            });
        }

        if (cookiesPolicyLink) {
            cookiesPolicyLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideTermsModal();
                this.showCookiesModal();
            });
        }

        // Allow scrolling inside modal content, prevent body scroll
        if (this.termsModal) {
            this.termsModal.addEventListener('wheel', (e) => {
                const modalBody = this.termsModal.querySelector('.terms-modal__body');
                if (modalBody && modalBody.contains(e.target)) {
                    // Allow scrolling inside modal body
                    return;
                }
                // Prevent scrolling on overlay
                e.preventDefault();
            }, { passive: false });
        }

        // Handle close buttons for privacy and cookies modals
        const closePrivacyBtn = document.getElementById('close-privacy');
        const closeCookiesBtn = document.getElementById('close-cookies');

        if (closePrivacyBtn) {
            closePrivacyBtn.addEventListener('click', () => {
                this.hidePrivacyModal();
            });
        }

        if (closeCookiesBtn) {
            closeCookiesBtn.addEventListener('click', () => {
                this.hideCookiesModal();
            });
        }

        // Handle close buttons in modal headers
        const privacyCloseBtn = this.privacyModal?.querySelector('.terms-modal__close');
        const cookiesCloseBtn = this.cookiesModal?.querySelector('.terms-modal__close');

        if (privacyCloseBtn) {
            privacyCloseBtn.addEventListener('click', () => {
                this.hidePrivacyModal();
            });
        }

        if (cookiesCloseBtn) {
            cookiesCloseBtn.addEventListener('click', () => {
                this.hideCookiesModal();
            });
        }

        // Allow scrolling inside privacy modal content
        if (this.privacyModal) {
            this.privacyModal.addEventListener('wheel', (e) => {
                const modalBody = this.privacyModal.querySelector('.terms-modal__body');
                if (modalBody && modalBody.contains(e.target)) {
                    // Allow scrolling inside modal body
                    return;
                }
                // Prevent scrolling on overlay
                e.preventDefault();
            }, { passive: false });
        }

        // Allow scrolling inside cookies modal content
        if (this.cookiesModal) {
            this.cookiesModal.addEventListener('wheel', (e) => {
                const modalBody = this.cookiesModal.querySelector('.terms-modal__body');
                if (modalBody && modalBody.contains(e.target)) {
                    // Allow scrolling inside modal body
                    return;
                }
                // Prevent scrolling on overlay
                e.preventDefault();
            }, { passive: false });
        }

        // Handle keyboard navigation for privacy modal
        if (this.privacyModal) {
            document.addEventListener('keydown', (e) => {
                if (this.privacyModal?.classList.contains('is-open')) {
                    if (e.key === 'Escape') {
                        this.hidePrivacyModal();
                    } else {
                        const modalBody = this.privacyModal.querySelector('.terms-modal__body');
                        if (modalBody && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) {
                            e.preventDefault();
                            const scrollAmount = e.key === 'ArrowDown' ? 50 : e.key === 'ArrowUp' ? -50 : e.key === 'PageDown' ? 200 : -200;
                            modalBody.scrollBy(0, scrollAmount);
                        }
                    }
                }
            });
        }

        // Handle keyboard navigation for cookies modal
        if (this.cookiesModal) {
            document.addEventListener('keydown', (e) => {
                if (this.cookiesModal?.classList.contains('is-open')) {
                    if (e.key === 'Escape') {
                        this.hideCookiesModal();
                    } else {
                        const modalBody = this.cookiesModal.querySelector('.terms-modal__body');
                        if (modalBody && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) {
                            e.preventDefault();
                            const scrollAmount = e.key === 'ArrowDown' ? 50 : e.key === 'ArrowUp' ? -50 : e.key === 'PageDown' ? 200 : -200;
                            modalBody.scrollBy(0, scrollAmount);
                        }
                    }
                }
            });
        }

        // Close modals on overlay click
        if (this.privacyModal) {
            this.privacyModal.addEventListener('click', (e) => {
                if (e.target === this.privacyModal || e.target.classList.contains('terms-modal__overlay')) {
                    this.hidePrivacyModal();
                }
            });
        }

        if (this.cookiesModal) {
            this.cookiesModal.addEventListener('click', (e) => {
                if (e.target === this.cookiesModal || e.target.classList.contains('terms-modal__overlay')) {
                    this.hideCookiesModal();
                }
            });
        }
    }

    // Public method to manually show terms (for footer links, etc.)
    showTerms() {
        this.showTermsModal();
    }

    // Public method to reset terms acceptance (for testing)
    resetTerms() {
        this.setTermsAccepted(false);
        this.showTermsBanner();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.termsManager = new TermsManager();
});

// Optional: Add terms link to footer or other pages
function addTermsLink() {
    const footer = document.querySelector('footer') || document.querySelector('.footer');
    if (footer && !footer.querySelector('.terms-link')) {
        const termsLink = document.createElement('a');
        termsLink.href = '#';
        termsLink.className = 'terms-link';
        termsLink.textContent = 'Пользовательское соглашение';
        termsLink.style.cssText = `
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            margin-left: 16px;
            transition: color 0.2s ease;
        `;
        
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.termsManager) {
                window.termsManager.showTerms();
            }
        });
        
        termsLink.addEventListener('mouseenter', () => {
            termsLink.style.color = 'var(--primary-color)';
        });
        
        termsLink.addEventListener('mouseleave', () => {
            termsLink.style.color = 'var(--text-muted)';
        });
        
        footer.appendChild(termsLink);
    }
}

// Auto-add terms link to footer if it exists
document.addEventListener('DOMContentLoaded', addTermsLink);

// Handle terms links in registration form
document.addEventListener('DOMContentLoaded', () => {
    const termsLink = document.getElementById('terms-link');
    const privacyLink = document.getElementById('privacy-link');
    
    // Only bind events if document viewer is not available
    if (termsLink && !window.documentViewer) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.termsManager) {
                window.termsManager.showTerms();
            }
        });
    }
    
    if (privacyLink && !window.documentViewer) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            // For now, show the same terms modal
            // In the future, you can create a separate privacy policy modal
            if (window.termsManager) {
                window.termsManager.showTerms();
            }
        });
    }
});
