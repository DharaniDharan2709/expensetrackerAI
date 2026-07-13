const API_BASE_URL = ''; // Leave empty for Render deployment (Flask serves everything)

const userList = document.getElementById('user-list');
const expenseList = document.getElementById('admin-expense-list');
const selectedName = document.getElementById('selected-user-name');
const selectedEmail = document.getElementById('selected-user-email');

// ==========================================
// 1. FETCH ALL USERS
// ==========================================
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderUserList(data.users);
        } else if (response.status === 403) {
            alert("Unauthorized Access");
            window.location.href = "index.html";
        }
    } catch (err) {
        console.error("Error loading users");
    }
}

function renderUserList(users) {
    userList.innerHTML = '';
    if (users.length === 0) {
        userList.innerHTML = '<p style="padding-left: 20px; color: #7f8c8d;">No users found.</p>';
        return;
    }

    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.style.padding = '10px 20px';
        userDiv.style.cursor = 'pointer';
        userDiv.style.color = '#ecf0f1';
        userDiv.style.borderLeft = '4px solid transparent';
        userDiv.innerHTML = `<strong>${user.fullname}</strong><br><small>${user.email}</small>`;
        
        userDiv.onclick = () => {
            // Highlight selected
            document.querySelectorAll('.user-item').forEach(el => el.style.borderLeftColor = 'transparent');
            userDiv.style.borderLeftColor = '#3498db';
            userDiv.style.backgroundColor = 'rgba(255,255,255,0.05)';
            
            viewUserExpenses(user);
        };
        
        userList.appendChild(userDiv);
    });
}

// ==========================================
// 2. VIEW SPECIFIC USER EXPENSES
// ==========================================
async function viewUserExpenses(user) {
    selectedName.innerText = user.fullname;
    selectedEmail.innerText = `Viewing expenses for: ${user.email}`;
    expenseList.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading expenses...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/user/${user.id}/expenses`, { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            renderExpenses(data.expenses);
        }
    } catch (err) {
        expenseList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading expenses</td></tr>';
    }
}

function renderExpenses(expenses) {
    expenseList.innerHTML = '';
    if (expenses.length === 0) {
        expenseList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#7f8c8d;">No expenses found for this user.</td></tr>';
        return;
    }

    expenses.forEach((exp, index) => {
        expenseList.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${exp.date}</td>
                <td>${exp.name}</td>
                <td style="font-weight:bold;">₹${exp.amount.toFixed(2)}</td>
            </tr>
        `;
    });
}

// ==========================================
// 3. LOGOUT
// ==========================================
// ==========================================
// 3. LOGOUT
// ==========================================
document.getElementById('admin-logout').onclick = async (e) => {
    e.preventDefault(); // Stop the link from jumping to the top of the page
    try {
        await fetch(`${API_BASE_URL}/logout`, { credentials: 'include' });
    } catch (e) {
        console.error("Logout error");
    }
    window.location.href = "index.html";
};
