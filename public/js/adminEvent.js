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
        modalType: '',
        event: {
            _id: '',
            eventId: '',
            name: '',
            venue: '',
            date: '',
            time: '',
            budget: '',
            remarks: ''
        },
        showDeleteModal: false,
        deleteEventId: null,
        search: '',
        events: [], // Will be populated from JSON script tag

        init() {
            console.log('adminEvent Alpine.js component initializing...');

            // Retrieve data from JSON script tag
            const rawEventsString = document.getElementById('raw-events-json').textContent;
            this.events = JSON.parse(rawEventsString).map(e => ({
                ...e,
                date: e.date ? new Date(e.date).toISOString().split('T')[0] : '' // Format date for input type="date"
            }));
            console.log('Initialized events:', this.events);

            this.$watch('showModal', value => {
                if (!value) {
                    this.resetForm();
                    this.editEventId = null;
                }
            });
        },

        // Computed property for filtered events
        get filteredEvents() {
            console.log('filteredEvents computed property accessed. Search:', this.search);
            if (!this.search) {
                console.log('No search term, returning all events.');
                return this.events;
            }
            const searchLower = this.search.toLowerCase();
            return this.events.filter(event => 
                (event.eventId && event.eventId.toLowerCase().includes(searchLower)) ||
                (event.name && event.name.toLowerCase().includes(searchLower)) ||
                (event.venue && event.venue.toLowerCase().includes(searchLower))
            );
        },

        openAddModal() {
            this.modalType = 'add';
            this.resetForm();
            this.showModal = true;
        },

        openEditModal(eventData) {
            console.log('Opening edit modal with data:', eventData);
            this.modalType = 'edit';
            this.event = {
                _id: eventData._id,
                eventId: eventData.eventId,
                name: eventData.name,
                venue: eventData.venue,
                date: this.formatDate(eventData.date),
                time: eventData.time,
                budget: eventData.budget,
                remarks: eventData.remarks
            };
            this.showModal = true;
        },

        openDeleteModal(id) {
            this.deleteEventId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.resetForm();
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteEventId = null;
        },

        resetForm() {
            this.event = {
                _id: '',
                eventId: '',
                name: '',
                venue: '',
                date: '',
                time: '',
                budget: '',
                remarks: ''
            };
        },

        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };
} 