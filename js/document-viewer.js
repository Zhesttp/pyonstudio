// Simple Document Viewer - opens PDF documents in new window
class DocumentViewer {
    constructor() {
        this.documents = {
            'provision_of_services': {
                title: 'Условия предоставления услуг',
                file: 'docs/provision_of_dervices.pdf'
            },
            'studio_rules': {
                title: 'Правила студии',
                file: 'docs/studiarules.pdf'
            }
        };
        
        this.init();
    }

    init() {
        this.bindTermsLinks();
    }

    bindTermsLinks() {
        const termsLink = document.getElementById('terms-link');
        const privacyLink = document.getElementById('privacy-link');
        
        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openDocument('provision_of_services');
            });
        }
        
        if (privacyLink) {
            privacyLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openDocument('studio_rules');
            });
        }
    }

    openDocument(documentKey) {
        const doc = this.documents[documentKey];
        if (!doc) {
            console.error('Document not found:', documentKey);
            return false;
        }

        // Open PDF document directly in new window
        const newWindow = window.open(
            doc.file,
            '_blank',
            'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=yes,menubar=yes,location=yes,status=yes'
        );
        
        // Focus the new window
        if (newWindow) {
            newWindow.focus();
            // Track document view event
            this.trackDocumentView(doc.title);
            return true;
        } else {
            // Fallback if popup blocked - show notification
            this.showNotification('Разрешите всплывающие окна для просмотра документов');
            return false;
        }
    }

    downloadDocument(filePath, title) {
        // Create a temporary link element to trigger download
        const link = document.createElement('a');
        link.href = filePath;
        link.download = title;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show notification
        this.showNotification('Документ скачивается...');
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    trackDocumentView(title) {
        // Optional: Send analytics event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'document_view', {
                event_category: 'documents',
                event_label: title
            });
        }
        
        console.log('Document viewed:', title);
    }

    // Public methods for external use
    showProvisionOfServices() {
        this.openDocument('provision_of_services');
    }

    showStudioRules() {
        this.openDocument('studio_rules');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.documentViewer = new DocumentViewer();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentViewer;
}
