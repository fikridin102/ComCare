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

function adminAnnouncement() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: 'add',
        announcement: {
            title: '',
            content: '',
            image: null
        },
        deleteAnnouncementId: null,
        search: '',

        init() {
            // Any initialization logic if needed
        },

        openEditModal(announcement) {
            this.announcement = { ...announcement };
            this.modalType = 'edit';
            this.showModal = true;
        },

        openAddModal() {
            this.announcement = {
                title: '',
                content: '',
                image: null
            };
            this.modalType = 'add';
            this.showModal = true;
        },

        openDeleteModal(id) {
            this.deleteAnnouncementId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.announcement = {
                title: '',
                content: '',
                image: null
            };
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteAnnouncementId = null;
        },

        handleImageUpload(event) {
            const file = event.target.files[0];
            if (file) {
                this.announcement.image = file;
            }
        }
    };
} 