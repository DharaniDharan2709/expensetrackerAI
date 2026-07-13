import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI

load_dotenv()

# Get the folder where app.py lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# DO NOT set static_folder to '.' — it hijacks API routes
app = Flask(__name__)

# ==========================================
# 1. SECURITY & DATABASE CONFIGURATION
# ==========================================
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dharani_secret_key_2026')

# Database Configuration
database_url = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "instance", "database.db")}')
# Neon gives 'postgres://' but SQLAlchemy needs 'postgresql://'
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {"pool_pre_ping": True}

CORS(app, supports_credentials=True)

db = SQLAlchemy(app)
login_manager = LoginManager(app)

# ==========================================
# 2. YOUR GROQ SETUP
# ==========================================
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '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')

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

# ==========================================
# 3. DATABASE TABLES
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

# Generate tables when the app starts
with app.app_context():
    try:
        db.create_all()
        print("Database tables created successfully!")
    except Exception as e:
        print(f"DATABASE ERROR: {e}")

# ==========================================
# 4. SERVE HTML/CSS/JS FILES
# ==========================================
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and check_password_hash(user.password, data['password']):
        login_user(user)
        
        # --- NEW ADMIN CHECK ---
        # Change this to whatever email you use to register your admin account!
        is_admin = (user.email == 'dharani@gmail.com') 
        
        return jsonify({"message": "Login successful!", "is_admin": is_admin})
    
    return jsonify({"message": "Invalid email or password"}), 401

# ==========================================
# 5. AUTHENTICATION ROUTES
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
# 6. DATABASE EXPENSE ROUTES
# ==========================================
# ==========================================
# ADMIN DASHBOARD ROUTES
# ==========================================
@app.route('/admin/users', methods=['GET'])
@login_required
def get_all_users():
    # Security: Only let the admin email load this data
    if current_user.email != 'dharani@gmail.com':
        return jsonify({"message": "Unauthorized Access"}), 403
        
    users = User.query.all()
    # Send back everyone EXCEPT the admin
    output = [{"id": u.id, "fullname": u.fullname, "email": u.email} for u in users if u.email != 'dharani@gmail.com']
    return jsonify({"users": output})

@app.route('/admin/user/<int:user_id>/expenses', methods=['GET'])
@login_required
def get_user_expenses(user_id):
    if current_user.email != 'indoorgaming22@gmail.com':
        return jsonify({"message": "Unauthorized Access"}), 403
        
    user_expenses = Expense.query.filter_by(user_id=user_id).all()
    output = [{"id": exp.id, "name": exp.name, "amount": exp.amount, "date": exp.date} for exp in user_expenses]
    return jsonify({"expenses": output})

# ==========================================
# 7. AI ROUTE
# ==========================================
@app.route('/analyze', methods=['POST'])
@login_required
def analyze_expenses():
    user_expenses = Expense.query.filter_by(user_id=current_user.id).all()

    if not user_expenses:
        return jsonify({"reply": "I don't see any expenses yet! Add some to your dashboard so I can analyze them."})

    expense_list_text = "\n".join([f"- {exp.date}: {exp.name} (Rs.{exp.amount})" for exp in user_expenses])

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
        print(f"GROQ ERROR: {e}") 
        return jsonify({"reply": "Groq had a hiccup! Check your terminal."})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)