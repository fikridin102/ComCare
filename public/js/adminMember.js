function adminMember() {
    return {
        showModal: false,
        modalType: '',
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
        },

        // Computed property for filtered members
        get filteredMembers() {
            console.log('filteredMembers computed property accessed. Search:', this.search);
            if (!this.search) {
                console.log('No search term, returning all members.');
                return this.members;
            }
            const searchLower = this.search.toLowerCase();
            return this.members.filter(member => 
                (member.customId && member.customId.toLowerCase().includes(searchLower)) ||
                member.fullname.toLowerCase().includes(searchLower) ||
                member.icNum.toLowerCase().includes(searchLower)
            );
        },

        openAddModal() {
            this.modalType = 'add';
            this.resetForm();
            this.showModal = true;
        },

        openEditModal(memberData) {
            console.log('Opening edit modal with data:', memberData);
            this.modalType = 'edit';
            this.member = {
                _id: memberData._id,
                customId: memberData.customId,
                fullname: memberData.fullname,
                username: memberData.username,
                email: memberData.email,
                icNum: memberData.icNum,
                birthDate: this.formatDate(memberData.birthDate),
                age: memberData.age,
                phoneNum: memberData.phoneNum,
                address: memberData.address,
                status: memberData.status
            };
            this.showModal = true;
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
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };
} 