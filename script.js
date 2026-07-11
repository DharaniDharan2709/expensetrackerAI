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
        const response = await fetch('http://127.0.0.1:5000/get-expenses', {
            method: 'GET',
            credentials: 'include' // Shows the login cookie!
        });

        if (response.ok) {
            const data = await response.json();
            expenses = data.expenses; 
            updateUI(); 
        } else {
            // If not logged in, kick them to the login page
            window.location.href = "auth.html";
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
        const response = await fetch('http://127.0.0.1:5000/save-expense', {
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

    const dashHead = document.querySelector('.expense-history thead');
    const transHead = document.querySelector('.transaction-table-wrapper thead');

    if (expenses.length === 0) {
        if(dashHead) dashHead.style.display = 'none';
        if(transHead) transHead.style.display = 'none';
        expenseList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: var(--text-secondary); font-size: 16px;">No expense entered</td></tr>';
        fullTransactionList.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-secondary); font-size: 16px;">No expense entered</td></tr>';
    } else {
        if(dashHead) dashHead.style.display = '';
        if(transHead) transHead.style.display = '';
        
        expenseList.innerHTML = '';
        fullTransactionList.innerHTML = '';

        expenses.forEach((exp, index) => {
            let rowHtml = `
                <tr>
                    <td>${index + 1}</td>
                    <td>${exp.name}</td>
                    <td style="font-weight:bold;">₹${exp.amount.toFixed(2)}</td>
                    <td></td>
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
                    <td></td>
                </tr>
            `;
        });
    }

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

budgetInput.addEventListener('input', (e) => {
    budget = parseFloat(e.target.value) || 0;
    localStorage.setItem('userBudget', budget);
    updateUI();
});

// ==========================================
// 4. POPUPS (MODALS) & SIDEBAR
// ==========================================
const transactionsModal = document.getElementById('transactions-modal');
const aiModal = document.getElementById('ai-chat-modal');

document.getElementById('open-transactions').onclick = () => transactionsModal.style.display = 'flex';
document.getElementById('close-transactions').onclick = () => transactionsModal.style.display = 'none';

document.getElementById('open-ai-chat').onclick = () => aiModal.style.display = 'flex';
document.getElementById('close-ai-chat').onclick = () => aiModal.style.display = 'none';

const mobileAiBtn = document.getElementById('mobile-floating-ai-btn');
if(mobileAiBtn) mobileAiBtn.onclick = () => aiModal.style.display = 'flex';


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
        const response = await fetch('http://127.0.0.1:5000/analyze', {
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

// ==========================================
// 6. MOBILE RESPONSIVENESS
// ==========================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebar = document.getElementById('sidebar');

if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('show-sidebar');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('show-sidebar') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('show-sidebar');
        }
    });
}