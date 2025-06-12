function adminMember() {
    return {
        showModal: false,
        showDeleteModal: false,
        modalType: 'add',
        member: {},
        deleteMemberId: null,
        search: '',

        init() {
            // Any initialization logic if needed
        },

        openEditModal(member) {
            this.member = { ...member };
            this.modalType = 'edit';
            this.showModal = true;
        },

        openDeleteModal(id) {
            this.deleteMemberId = id;
            this.showDeleteModal = true;
        },

        closeModal() {
            this.showModal = false;
            this.member = {};
        },

        closeDeleteModal() {
            this.showDeleteModal = false;
            this.deleteMemberId = null;
        }
    };
} 