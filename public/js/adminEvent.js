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
        pendingEventData: null, // New property to temporarily hold event data

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
                if (value) {
                    // When modal opens, populate the event data from pendingEventData
                    this.$nextTick(() => {
                        if (this.pendingEventData) {
                            const eventData = this.pendingEventData;
                            const formattedDate = eventData.date ? this.formatDate(eventData.date) : '';
                            this.event = {
                                _id: eventData._id || '',
                                eventId: eventData.eventId || '',
                                name: eventData.name || '',
                                venue: eventData.venue || '',
                                date: formattedDate,
                                time: eventData.time || '',
                                budget: eventData.budget || '',
                                remarks: eventData.remarks || ''
                            };
                            console.log('Set event data for editing via $watch:', this.event);
                            this.pendingEventData = null; // Clear pending data
                        }
                    });
                } else {
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
            console.log('Opening edit modal with raw data:', eventData);
            this.modalType = 'edit';
            this.pendingEventData = eventData; // Store data temporarily
            this.showModal = true; // Open modal, data will be set by $watch
            console.log('Stored pending event data and opening modal.');
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
        },

        async submitEditForm() {
            try {
                console.log('Submitting edit form for event:', this.event);
                
                const formData = new FormData();
                formData.append('_csrf', document.querySelector('input[name="_csrf"]').value);
                formData.append('id', this.event._id);
                formData.append('name', this.event.name);
                formData.append('venue', this.event.venue);
                formData.append('date', this.event.date);
                formData.append('time', this.event.time);
                formData.append('budget', this.event.budget);
                formData.append('remarks', this.event.remarks);

                const response = await fetch(`/adminevent/edit/${this.event._id}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    window.location.reload();
                } else {
                    console.error('Error updating event:', response.statusText);
                    alert('Error updating event. Please try again.');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Error updating event. Please try again.');
            }
        }
    };
} 