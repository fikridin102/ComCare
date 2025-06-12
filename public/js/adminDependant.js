function adminDependant() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: 'add',
        dependant: {},
        deleteDependantId: null,
        members: [],
        search: '',

        init() {
            console.log('Initializing adminDependant...');
            // Fetch members for dropdown
            fetch('/api/members')
                .then(response => response.json())
                .then(data => {
                    console.log('Fetched members:', data);
                    this.members = data;
                })
                .catch(error => {
                    console.error('Error fetching members:', error);
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

        openEditModal(dependant) {
            console.log('Opening edit modal for:', dependant);
            this.dependant = { ...dependant };
            this.modalType = 'edit';
            this.showModal = true;
        },

        openDeleteModal(id) {
            console.log('Opening delete modal for:', id);
            this.deleteDependantId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            console.log('Closing modal');
            this.showModal = false;
            this.dependant = {};
        },

        closeDeleteModal() {
            console.log('Closing delete modal');
            this.showDeleteModal = false;
            this.deleteDependantId = null;
        }
    };
} 