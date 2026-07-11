// Grab the panels
const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');

// Grab the toggle links
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

// Switch to Registration View
showRegisterBtn.addEventListener('click', () => {
    loginPanel.style.opacity = '0';
    loginPanel.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        loginPanel.style.display = 'none';
        registerPanel.style.display = 'block';
        setTimeout(() => {
            registerPanel.style.opacity = '1';
            registerPanel.style.transform = 'translateY(0)';
        }, 50);
    }, 400);
});

// Switch back to Login View
showLoginBtn.addEventListener('click', () => {
    registerPanel.style.opacity = '0';
    registerPanel.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        registerPanel.style.display = 'none';
        loginPanel.style.display = 'block';
        setTimeout(() => {
            loginPanel.style.opacity = '1';
            loginPanel.style.transform = 'translateY(0)';
        }, 50);
    }, 400);
});

// Real Login Button Click
document.getElementById('login-submit').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if(!email || !password) return alert("Please enter both email and password.");

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log("Login Response Data:", data); // Helpful for developers

        if (response.ok) {
            // DEBUG ALERT: You can remove this after it works!
            alert("Login Success! Admin Status: " + data.is_admin);

            if (data.is_admin === true) {
                window.location.href = "admin.html";
            } else {
                window.location.href = "dashboard.html";
            }
        } else {
            alert(data.message || "Login failed");
        }
    } catch (error) {
        alert("Server error. Is the backend running?");
    }
});

// Real Register Button Click
document.getElementById('register-submit').addEventListener('click', async () => {
    const fullname = document.getElementById('reg-fullname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if(!fullname || !email || !password) return alert("Please fill out all registration fields.");

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullname, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            showLoginBtn.click();
        } else {
            alert(data.message || "Registration failed");
        }
    } catch (error) {
        alert("Server error. Is the backend running?");
    }
});