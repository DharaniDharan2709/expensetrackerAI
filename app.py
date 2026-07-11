import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI

app = Flask(__name__)

# ==========================================
# 1. NEW: SECURITY & DATABASE CONFIGURATION
# ==========================================
# Required for secure login sessions
app.config['SECRET_KEY'] = 'dharani_secret_key_2026'
# Tells Python to create a 'database.db' file in your folder
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# CRITICAL: supports_credentials=True allows the browser to remember you are logged in
load_dotenv()
frontend_url = os.environ.get('FRONTEND_URL', 'http://127.0.0.1:5500')
CORS(app, supports_credentials=True, resources={r"/*": {"origins": [frontend_url, "http://localhost:5500", "http://127.0.0.1:5000", "http://localhost:5000"]}})

db = SQLAlchemy(app)
login_manager = LoginManager(app)

# ==========================================
# 2. YOUR GROQ SETUP
# ==========================================
# Paste your NEW Groq API key inside the quotes
GROQ_API_KEY = "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"

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

# ==========================================
# 3. NEW: DATABASE TABLES
# ==========================================
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fullname = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    expenses = db.relationship('Expense', backref='owner', lazy=True)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.String(50))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Generate the database file when the app starts
with app.app_context():
    db.create_all()

# ==========================================
# 4. NEW: AUTHENTICATION ROUTES
# ==========================================
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Email already exists!"}), 400
    
    hashed_pw = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(fullname=data['fullname'], email=data['email'], password=hashed_pw)
    
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Account created successfully!"})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and check_password_hash(user.password, data['password']):
        login_user(user)
        return jsonify({"message": "Login successful!"})
    
    return jsonify({"message": "Invalid email or password"}), 401

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out!"})

# ==========================================
# 5. NEW: DATABASE EXPENSE ROUTES
# ==========================================
@app.route('/save-expense', methods=['POST'])
@login_required
def save_expense():
    data = request.json
    new_expense = Expense(
        name=data['name'],
        amount=data['amount'],
        date=data['date'],
        user_id=current_user.id
    )
    db.session.add(new_expense)
    db.session.commit()
    return jsonify({"message": "Expense saved to database!"})

@app.route('/get-expenses', methods=['GET'])
@login_required
def get_expenses():
    user_expenses = Expense.query.filter_by(user_id=current_user.id).all()
    output = [{"id": exp.id, "name": exp.name, "amount": exp.amount, "date": exp.date} for exp in user_expenses]
    return jsonify({"expenses": output})

# ==========================================
# 6. YOUR MODIFIED AI ROUTE
# ==========================================
@app.route('/analyze', methods=['POST'])
@login_required # Makes sure only logged-in users can use the AI
def analyze_expenses():
    # Now it pulls directly from your permanent database!
    user_expenses = Expense.query.filter_by(user_id=current_user.id).all()

    if not user_expenses:
        return jsonify({"reply": "I don't see any expenses yet! Add some to your dashboard so I can analyze them."})

    expense_list_text = "\n".join([f"- {exp.date}: {exp.name} (₹{exp.amount})" for exp in user_expenses])

    prompt = f"""
    You are an expert, witty financial advisor.

Analyze the following expense data:
{expense_list_text}

Provide a brief and insightful financial analysis.

Requirements:
- Identify the HIGHEST EXPENSE category and amount.
- List the top spending categories in descending order.
- Use CAPITAL LETTERS for expense category names.
- Give 2-3 practical savings tips based on the user's spending habits.
- Suggest where the user can reduce spending.
- Keep the advice realistic and actionable.
- End with a positive and encouraging financial statement.
- Use emojis and clear formatting.
- Keep the response concise and easy to read.

Format the response like:

📊 EXPENSE ANALYSIS

1. CATEGORY NAME — Amount
2. CATEGORY NAME — Amount

🔥 HIGHEST EXPENSE:
Category — Amount

💡 SAVING TIPS:
• Tip 1
• Tip 2
• Tip 3

🚀 Keep going! [encouraging closing statement]
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[
                {"role": "system", "content": "You are a helpful and funny financial assistant."},
                {"role": "user", "content": prompt},
            ],
        )
        return jsonify({"reply": response.choices[0].message.content})
        
    except Exception as e:
        print(f"❌ GROQ ERROR: {e}") 
        return jsonify({"reply": "Groq had a hiccup! Check your terminal."})

if __name__ == '__main__':
    app.run(debug=True, port=5000)