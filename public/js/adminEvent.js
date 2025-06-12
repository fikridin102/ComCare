// Add CSRF token to all AJAX requests
document.addEventListener('DOMContentLoaded', function() {
    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    
    // Add CSRF token to all AJAX requests
    const originalFetch = window.fetch;
    window.fetch = function() {
        let [resource, config] = arguments;
        if (config === undefined) {
            config = {};
        }
        if (config.headers === undefined) {
            config.headers = {};
        }
        // Add CSRF token to headers
        config.headers['CSRF-Token'] = csrfToken;
        config.headers['X-CSRF-Token'] = csrfToken;
        return originalFetch(resource, config);
    };

    // Add CSRF token to all forms
    document.querySelectorAll('form').forEach(form => {
        if (!form.querySelector('input[name="_csrf"]')) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
        }
    });
});

function adminEvent() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: 'add',
        event: {},
        deleteEventId: null,
        search: '',

        init() {
            // Any initialization logic if needed
        },

        openEditModal(event) {
            this.event = { ...event };
            this.modalType = 'edit';
            this.showModal = true;
        },

        openDeleteModal(id) {
            this.deleteEventId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.event = {};
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteEventId = null;
        }
    };
} 