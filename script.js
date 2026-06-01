// ==========================================
// 1. GRAB ELEMENTS FROM YOUR HTML
// ==========================================
const budgetInput = document.getElementById('budget');
const balanceText = document.querySelector('.balance-card p');
const aiAdviceText = document.getElementById('ai-advice-text');

const expenseName = document.getElementById('expense-name');
const expenseAmount = document.getElementById('expense-amount');
const updateBtn = document.getElementById('update-btn');

const expenseList = document.getElementById('expense-list'); 
const fullTransactionList = document.getElementById('full-transaction-list'); 

let expenses = [];
let budget = localStorage.getItem('userBudget') || 0;
if (budget > 0) budgetInput.value = budget;

function getAutoDate() {
    const d = new Date();
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==========================================
// 2. LOAD DATA FROM DATABASE ON STARTUP
// ==========================================
async function loadExpenses() {
    try {
        const response = await fetch('/get-expenses', {
            method: 'GET',
            credentials: 'include' // Shows the login cookie!
        });

        if (response.ok) {
            const data = await response.json();
            expenses = data.expenses; 
            updateUI(); 
        } else {
            // If not logged in, kick them to the login page
            window.location.href = "index.html";
        }
    } catch (err) {
        console.error("Server not running.");
    }
}

// Run this the second the dashboard opens
loadExpenses();

// ==========================================
// 3. SAVE EXPENSE TO DATABASE
// ==========================================
updateBtn.addEventListener('click', async () => {
    const name = expenseName.value.trim();
    const amount = parseFloat(expenseAmount.value);
    
    if(!name || isNaN(amount) || amount <= 0) return alert("Enter valid details.");

    updateBtn.innerText = "Saving...";

    try {
        // Send to Python Database
        const response = await fetch('/save-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Shows the login cookie!
            body: JSON.stringify({ name: name, amount: amount, date: getAutoDate() })
        });

        if (response.ok) {
            expenseName.value = '';
            expenseAmount.value = '';
            await loadExpenses(); // Refresh list from database
        } else {
            alert("Session expired. Please log in again.");
        }
    } catch(e) {
        alert("Server error.");
    }
    updateBtn.innerText = "Update";
});

function updateUI() {
    let totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    let balance = budget - totalSpent;
    balanceText.innerText = "₹" + balance.toFixed(2);
    balanceText.style.color = balance < 0 ? "#e74c3c" : "#2ecc71";

    expenseList.innerHTML = '';
    fullTransactionList.innerHTML = '';

    expenses.forEach((exp, index) => {
        let rowHtml = `
            <tr>
                <td>${index + 1}</td>
                <td>${exp.name}</td>
                <td style="font-weight:bold;">₹${exp.amount.toFixed(2)}</td>
                <td><button class="delete-btn" onclick="deleteExpense(${exp.id})">🗑️ Delete</button></td>
            </tr>
        `;
        expenseList.innerHTML += rowHtml;

        fullTransactionList.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${exp.date}</td>
                <td>${exp.name}</td>
                <td>---</td>
                <td style="font-weight:bold;">₹${exp.amount.toFixed(2)}</td>
                <td><button class="delete-btn" onclick="deleteExpense(${exp.id})">🗑️ Delete</button></td>
            </tr>
        `;
    });

    if (budget == 0) {
        aiAdviceText.innerText = "👋 Hello! Set a budget to get started.";
    } else if (totalSpent > budget) {
        aiAdviceText.innerText = "🚨 ALERT: You are over budget!";
        aiAdviceText.style.color = "#e74c3c";
    } else {
        aiAdviceText.innerText = "✅ Looking good! Keep tracking your expenses.";
        aiAdviceText.style.color = "#2c3e50";
    }
}

// ==========================================
// 4. DELETE EXPENSE FROM DATABASE
// ==========================================
async function deleteExpense(id) {
    if(!confirm("Are you sure you want to delete this expense?")) return;

    try {
        const response = await fetch(`/delete-expense/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await loadExpenses(); // Refresh list
        } else {
            alert("Could not delete expense.");
        }
    } catch (e) {
        alert("Server error.");
    }
}

budgetInput.addEventListener('input', (e) => {
    budget = parseFloat(e.target.value) || 0;
    localStorage.setItem('userBudget', budget);
    updateUI();
});

// ==========================================
// 4. POPUPS (MODALS) & SIDEBAR
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const transactionsModal = document.getElementById('transactions-modal');
const aiModal = document.getElementById('ai-chat-modal');

document.getElementById('open-settings').onclick = () => settingsModal.style.display = 'flex';
document.getElementById('close-settings').onclick = () => settingsModal.style.display = 'none';

document.getElementById('open-transactions').onclick = () => transactionsModal.style.display = 'flex';
document.getElementById('close-transactions').onclick = () => transactionsModal.style.display = 'none';

document.getElementById('open-ai-chat').onclick = () => aiModal.style.display = 'flex';
document.getElementById('close-ai-chat').onclick = () => aiModal.style.display = 'none';

const darkModeBtn = document.getElementById('dark-mode-toggle');
darkModeBtn.onclick = () => {
    document.body.classList.toggle('dark-mode');
    darkModeBtn.innerText = document.body.classList.contains('dark-mode') ? "☀️ Disable" : "🌙 Enable";
};

document.getElementById('logout-link').onclick = async () => {
    try {
        await fetch('/logout', {
            method: 'GET',
            credentials: 'include'
        });
    } catch (e) {
        console.error("Logout failed at server, but redirecting anyway.");
    }
    window.location.href = "index.html";
};

// ==========================================
// 5. GROQ AI INTEGRATION (FIXED 401 ERROR)
// ==========================================
const runAnalysisBtn = document.getElementById('run-analysis-btn');
const chatWindow = document.getElementById('chat-window');

runAnalysisBtn.addEventListener('click', async () => {
    chatWindow.innerHTML = "<em>Sending your database history to Groq for analysis... 🚀</em>";
    runAnalysisBtn.disabled = true;

    try {
        // Notice we added credentials: 'include' so Python knows who is logged in!
        // We also stopped sending the array, because Python checks the database directly now.
        const response = await fetch('/analyze', {
            method: 'POST',
            credentials: 'include' 
        });
        
        if (response.status === 401) {
            chatWindow.innerHTML = "<span style='color:red;'>Error 401: You must log in first!</span>";
        } else {
            const data = await response.json();
            chatWindow.innerHTML = data.reply; 
        }

    } catch(e) {
        chatWindow.innerHTML = "<span style='color:red;'>Connection Error. Is the Python server running?</span>";
    }
    
    runAnalysisBtn.disabled = false;
});