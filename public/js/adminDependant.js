function adminDependant() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: '',
        dependant: {
            _id: '',
            name: '',
            ic: '',
            birthday: '',
            age: '',
            gender: '',
            relationship: '',
            memberId: ''
        },
        deleteDependantId: null,
        search: '',
        dependants: [],
        members: [],

        init() {
            console.log('adminDependant Alpine.js component initializing...');

            // Retrieve data from JSON script tags
            const rawDependantsString = document.getElementById('raw-dependants-json').textContent;
            this.dependants = JSON.parse(rawDependantsString).map(d => ({
                ...d,
                birthday: d.birthday ? new Date(d.birthday).toISOString().split('T')[0] : '' // Format date for input type="date"
            }));
            console.log('Initialized dependants:', this.dependants);

            const rawMembersString = document.getElementById('raw-members-json').textContent;
            this.members = JSON.parse(rawMembersString);
            console.log('Initialized members:', this.members);

            this.memberName = '<%- user.fullname || user.username %>'; // Keep this if memberName is needed from EJS

            this.$watch('showModal', value => {
                if (!value) {
                    this.resetForm();
                }
                });
        },

        calculateAge(birthday) {
            if (!birthday) return '';
            const today = new Date();
            const birthDate = new Date(birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            return age;
        },

        get filteredDependants() {
            console.log('filteredDependants computed property accessed. Search:', this.search);
            if (!this.search) {
                console.log('No search term, returning all dependants.');
                return this.dependants;
            }
            const searchLower = this.search.toLowerCase();
            return this.dependants.filter(dependant => 
                (dependant.name && dependant.name.toLowerCase().includes(searchLower)) ||
                (dependant.ic && dependant.ic.toLowerCase().includes(searchLower)) ||
                (dependant.memberName && dependant.memberName.toLowerCase().includes(searchLower))
            );
        },

        openEditModal(dependantData) {
            console.log('Opening edit modal with data:', dependantData);
            this.modalType = 'edit';
            this.showModal = true;
            this.editDependatId = dependantData._id;
        },

        openAddModal() {
            this.modalType = 'add';
            this.resetForm();
            this.showModal = true;
        },

        openDeleteModal(id) {
            this.deleteDependantId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.resetForm();
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteDependantId = null;
        },

        resetForm() {
            this.dependant = {
                _id: '',
                name: '',
                ic: '',
                birthday: '',
                age: '',
                gender: '',
                relationship: '',
                memberId: ''
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

        async submitForm() {
            try {
                console.log('Submitting form with data:', this.dependant);
                
                // Create a temporary form element
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/admindependant';

                // Add CSRF token
                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = '_csrf';
                csrfInput.value = document.querySelector('input[name="_csrf"]').value;
                form.appendChild(csrfInput);

                // Add all form fields
                const fields = {
                    name: this.dependant.name,
                    ic: this.dependant.ic,
                    birthday: this.dependant.birthday,
                    age: this.dependant.age,
                    gender: this.dependant.gender,
                    relationship: this.dependant.relationship,
                    memberId: this.dependant.memberId
                };

                for (const [key, value] of Object.entries(fields)) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = value;
                    form.appendChild(input);
                }

                // Add form to document, submit it, and remove it
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Error adding dependant. Please try again.');
            }
        }
    };
} 