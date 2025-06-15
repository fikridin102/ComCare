function adminDependant() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: '',
        editDependantId: null,
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
                    this.editDependantId = null;
                }
            });

            this.$watch('editDependantId', id => {
                if (id) {
                    const dependant = this.dependants.find(d => d._id === id);
                    if (dependant) {
                        this.dependant = {
                            _id: dependant._id,
                            name: dependant.name,
                            ic: dependant.ic,
                            birthday: this.formatDate(dependant.birthday),
                            age: dependant.age,
                            gender: dependant.gender,
                            relationship: dependant.relationship,
                            memberId: dependant.memberId
                        };
                        this.modalType = 'edit';
                    }
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
            this.dependant = {
                _id: dependantData._id,
                name: dependantData.name,
                ic: dependantData.ic,
                birthday: this.formatDate(dependantData.birthday),
                age: dependantData.age,
                gender: dependantData.gender,
                relationship: dependantData.relationship,
                memberId: dependantData.memberId
            };
            this.showModal = true;
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
        }
    };
} 