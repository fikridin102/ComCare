document.addEventListener('alpine:init', () => {
    Alpine.data('loginData', () => ({
        showForgotPasswordModal: false,
        showSuccessPopup: false,
        showErrorPopup: false,
        errorMessage: '',
        email: '',
        showSuccess(message) {
            this.errorMessage = message;
            this.showSuccessPopup = true;
            this.showErrorPopup = false;
            setTimeout(() => {
                this.showSuccessPopup = false;
            }, 3000);
        },
        showError(message) {
            this.errorMessage = message;
            this.showErrorPopup = true;
            setTimeout(() => {
                this.showErrorPopup = false;
            }, 3000);
        },
        async sendResetEmail() {
            try {
                const response = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': document.querySelector('input[name="_csrf"]').value,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email: this.email })
                });

                const data = await response.json();

                if (response.ok) {
                    this.showSuccess(data.message);
                    this.showForgotPasswordModal = false;
                    this.email = ''; // Clear email field
                } else {
                    this.showError(data.message || 'Failed to send password reset email.');
                }
            } catch (error) {
                console.error('Error sending reset email:', error);
                this.showError('An unexpected error occurred.');
            }
        }
    }));
}); 