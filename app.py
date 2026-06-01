import os
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from openai import OpenAI
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

app = Flask(__name__, static_url_path='', static_folder='.')

# ==========================================
# 1. NEW: SECURITY & DATABASE CONFIGURATION
# ==========================================
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')

# FIX: Render/Postgres strings often start with 'postgres://', but SQLAlchemy needs 'postgresql://'
if app.config['SQLALCHEMY_DATABASE_URI'].startswith("postgres://"):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

db = SQLAlchemy(app)
login_manager = LoginManager(app)

# ==========================================
# 2. YOUR GROQ SETUP
# ==========================================
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

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
# 4. FRONTEND ROUTES (For Hosting)
# ==========================================
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/auth.html')
def serve_auth():
    return send_from_directory('.', 'auth.html')

@app.route('/dashboard.html')
def serve_dashboard():
    return send_from_directory('.', 'dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ==========================================
# 5. NEW: AUTHENTICATION ROUTES
# ==========================================
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"message": "Email already exists!"}), 400
        
        hashed_pw = generate_password_hash(data['password'], method='pbkdf2:sha256')
        new_user = User(fullname=data['fullname'], email=data['email'], password=hashed_pw)
        
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "Account created successfully!"})
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"message": "Internal server error during registration"}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        user = User.query.filter_by(email=data['email']).first()
        
        if user and check_password_hash(user.password, data['password']):
            login_user(user)
            return jsonify({"message": "Login successful!"})
        
        return jsonify({"message": "Invalid email or password"}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"message": "Internal server error during login"}), 500

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
@login_required
def analyze_expenses():
    user_expenses = Expense.query.filter_by(user_id=current_user.id).all()

    if not user_expenses:
        return jsonify({"reply": "I don't see any expenses yet! Add some to your dashboard so I can analyze them."})

    expense_list_text = "\n".join([f"- {exp.date}: {exp.name} (₹{exp.amount})" for exp in user_expenses])

    prompt = f"""
    You are an expert, witty financial advisor. 
    Analyze these expenses:
    {expense_list_text}
    
    Provide a brief, insightful analysis. Mention the highest expense, 
    one saving tip, and an encouraging closing statement. 
    Use emojis and clear formatting.
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
        return jsonify({"reply": "Groq had a hiccup!"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
