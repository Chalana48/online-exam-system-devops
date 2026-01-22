// Frontend JavaScript for Online Exam System
console.log('Frontend loaded successfully');

// Login Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Basic validation
            if (!username || !password) {
                alert('Please fill in both username and password');
                return;
            }
            
            // Simulate login process
            console.log('Login attempt:', username);
            
            // Show loading state
            const loginBtn = document.querySelector('.btn-login');
            const originalText = loginBtn.textContent;
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            // Simulate API call
            setTimeout(() => {
                // For demo purposes - redirect to exam page
                alert('Login successful! Redirecting to exam...');
                loginBtn.textContent = originalText;
                loginBtn.disabled = false;
                
                // In real application, you would redirect to exam page
                // window.location.href = 'exam.html';
            }, 1500);
        });
    }
    
    // Welcome message
    console.log('Online Exam System Frontend v1.0');
});
