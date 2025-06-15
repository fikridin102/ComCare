function adminMember() {
    return {
        showModal: false,
        modalType: '',
        editMemberId: null,
        member: {
            _id: '',
            customId: '',
            fullname: '',
            username: '',
            email: '',
            icNum: '',
            birthDate: '',
            age: '',
            phoneNum: '',
            address: '',
            status: ''
        },
        showDeleteModal: false,
        deleteMemberId: null,
        search: '',
        members: [], // Will be populated from JSON script tag

        get filteredMembers() {
            if (!this.search) return this.members;
            const searchLower = this.search.toLowerCase();
            return this.members.filter(member => 
                member.fullname.toLowerCase().includes(searchLower) ||
                member.customId.toLowerCase().includes(searchLower)
            );
        },

        init() {
            console.log('adminMember Alpine.js component initializing...');

            // Retrieve data from JSON script tag
            const rawMembersString = document.getElementById('raw-members-json').textContent;
            this.members = JSON.parse(rawMembersString).map(m => ({
                ...m,
                birthDate: m.birthDate ? new Date(m.birthDate).toISOString().split('T')[0] : '' // Format date for input type="date"
            }));
            console.log('Initialized members:', this.members);

            this.$watch('showModal', value => {
                if (!value) {
                    this.resetForm();
                    this.editMemberId = null;
                }
            });

            this.$watch('editMemberId', id => {
                if (id) {
                    console.log('editMemberId changed to:', id);
                    const memberToEdit = this.members.find(m => m._id === id);
                    if (memberToEdit) {
                        console.log('Found member to edit:', memberToEdit);
                        Object.assign(this.member, {
                            _id: memberToEdit._id || '',
                            customId: memberToEdit.customId || '',
                            fullname: memberToEdit.fullname || '',
                            username: memberToEdit.username || '',
                            email: memberToEdit.email || '',
                            icNum: memberToEdit.icNum || '',
                            birthDate: memberToEdit.birthDate ? new Date(memberToEdit.birthDate).toISOString().split('T')[0] : '',
                            age: memberToEdit.age || '',
                            phoneNum: memberToEdit.phoneNum || '',
                            address: memberToEdit.address || '',
                            status: memberToEdit.status || ''
                        });
                        console.log('Member data set via $watch:', this.member);

                        // Force DOM update for specific elements after data is set
                        this.$nextTick(() => {
                            console.log('Attempting to manually prefill form fields...');
                            const form = this.$el.querySelector('form[action*="/adminmembers/edit/"]');
                            if (form) {
                                // Select input fields by name and set their values
                                const fields = ['fullname', 'username', 'email', 'icNum', 'birthDate', 'phoneNum', 'address'];
                                fields.forEach(fieldName => {
                                    const input = form.querySelector(`[name="${fieldName}"]`);
                                    if (input && this.member[fieldName] !== undefined) {
                                        input.value = this.member[fieldName];
                                        console.log(`Set ${fieldName} to: ${input.value}`);
                                    }
                                });

                                // Handle select element separately
                                const statusSelect = form.querySelector('[name="status"]');
                                if (statusSelect && this.member.status !== undefined) {
                                    statusSelect.value = this.member.status;
                                    console.log(`Set status to: ${statusSelect.value}`);
                                }
                            }
                        });
                    }
                }
            });
        },

        openAddModal() {
            this.modalType = 'add';
            this.resetForm();
            this.showModal = true;
        },

        openEditModal(memberData) {
            console.log('Opening edit modal with data:', memberData);
            this.modalType = 'edit';
            this.showModal = true;
            this.editMemberId = memberData._id;
        },

        openDeleteModal(id) {
            this.deleteMemberId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.resetForm();
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteMemberId = null;
        },

        resetForm() {
            this.member = {
                _id: '',
                customId: '',
                fullname: '',
                username: '',
                email: '',
                icNum: '',
                birthDate: '',
                age: '',
                phoneNum: '',
                address: '',
                status: ''
            };
        },

        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };
} 