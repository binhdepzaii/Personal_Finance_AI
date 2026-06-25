from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, Any
import hashlib
import secrets
from database import get_connection, init_db
from ai_service import parse_transaction_text, analyze_transactions, answer_finance_question

app = FastAPI(
    title="Personal Finance AI Backend",
    description="Backend API cho ứng dụng quản lý tài chính cá nhân có trợ lý AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tôi để tạm "*" thay vì [""] để CORS hoạt động bình thường, nếu ông có domain cụ thể thì điền vào nhé
    allow_credentials=True,
    allow_methods=["*"], # Tương tự, cho phép mọi method GET, POST, PUT, DELETE
    allow_headers=["*"],
)

init_db()

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class WalletCreateRequest(BaseModel):
    wallet_name: str
    balance: float = 0
    currency: str = "VND"

class WalletUpdateRequest(BaseModel):
    wallet_name: str
    balance: float
    currency: str = "VND"

class AIParseRequest(BaseModel):
    text: str

class AITransactionItem(BaseModel):
    id: Optional[int] = None
    date: Optional[str] = None
    trans_date: Optional[str] = None
    type: Optional[str] = None
    trans_type: Optional[str] = None
    transaction_type: Optional[str] = None
    category: Optional[str] = "Khác"
    amount: float = 0
    note: Optional[str] = ""

class AIAnalyzeRequest(BaseModel):
    transactions: list[AITransactionItem] = []

class AIChatRequest(BaseModel):
    question: str
    transactions: list[AITransactionItem] = []


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def create_token() -> str:
    return secrets.token_hex(32)

def get_current_user(authorization: str | None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Thiếu token đăng nhập")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token không đúng định dạng")

    token = authorization.replace("Bearer ", "").strip()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT users.id, users.full_name, users.email, users.created_at
        FROM sessions
        JOIN users ON sessions.user_id = users.id
        WHERE sessions.token = ?
    """, (token,))

    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết phiên")

    return dict(user)

@app.get("/")
def root():
    return {
        "message": "Personal Finance AI Backend đang hoạt động",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "database": "connected",
        "message": "Backend hoạt động bình thường"
    }

@app.post("/api/auth/register")
def register(data: RegisterRequest):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")
    
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (data.email,))
    existed_user = cursor.fetchone()

    if existed_user:
        conn.close()
        raise HTTPException(status_code=400, detail="Email đã được đăng ký")

    password_hash = hash_password(data.password)

    cursor.execute("""
        INSERT INTO users (full_name, email, password_hash)
        VALUES (?, ?, ?)
    """, (data.full_name, data.email, password_hash))

    user_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO wallets (user_id, wallet_name, balance, currency)
        VALUES (?, ?, ?, ?)
    """, (user_id, "Ví mặc định", 0, "VND"))

    conn.commit()
    conn.close()

    return {
        "message": "Đăng ký tài khoản thành công",
        "user": {
            "id": user_id,
            "full_name": data.full_name,
            "email": data.email
        }
    }

@app.post("/api/auth/login")
def login(data: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    password_hash = hash_password(data.password)

    cursor.execute("""
        SELECT id, full_name, email, created_at
        FROM users
        WHERE email = ? AND password_hash = ?
    """, (data.email, password_hash))

    user = cursor.fetchone()

    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    token = create_token()

    cursor.execute("""
        INSERT INTO sessions (user_id, token)
        VALUES (?, ?)
    """, (user["id"], token))

    conn.commit()
    conn.close()

    return {
        "message": "Đăng nhập thành công",
        "token": token,
        "token_type": "Bearer",
        "user": dict(user)
    }

@app.get("/api/auth/me")
def get_me(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    return {
        "message": "Lấy thông tin người dùng thành công",
        "user": user
    }

@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Thiếu token đăng nhập")
    
    token = authorization.replace("Bearer ", "").strip()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))

    conn.commit()
    conn.close()

    return {
        "message": "Đăng xuất thành công"
    }

@app.post("/api/wallets")
def create_wallet(data: WalletCreateRequest, authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    if not data.wallet_name.strip():
        raise HTTPException(status_code=400, detail="Tên ví không được để trống")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO wallets (user_id, wallet_name, balance, currency)
        VALUES (?, ?, ?, ?)
    """, (user["id"], data.wallet_name, data.balance, data.currency))

    wallet_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        "message": "Tạo ví tiền thành công",
        "wallet": {
            "id": wallet_id,
            "wallet_name": data.wallet_name,
            "balance": data.balance,
            "currency": data.currency
        }
    }

@app.get("/api/wallets")
def get_wallets(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, wallet_name, balance, currency, created_at
        FROM wallets
        WHERE user_id = ?
        ORDER BY id DESC
    """, (user["id"],))

    wallets = cursor.fetchall()
    conn.close()

    return {
        "message": "Lấy danh sách ví thành công",
        "wallets": [dict(wallet) for wallet in wallets]
    }

@app.put("/api/wallets/{wallet_id}")
def update_wallet(
    wallet_id: int,
    data: WalletUpdateRequest,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM wallets
        WHERE id = ? AND user_id = ?
    """, (wallet_id, user["id"]))

    wallet = cursor.fetchone()

    if not wallet:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    cursor.execute("""
        UPDATE wallets
        SET wallet_name = ?, balance = ?, currency = ?
        WHERE id = ? AND user_id = ?
    """, (data.wallet_name, data.balance, data.currency, wallet_id, user["id"]))

    conn.commit()
    conn.close()

    return {
        "message": "Cập nhật ví tiền thành công",
        "wallet": {
            "id": wallet_id,
            "wallet_name": data.wallet_name,
            "balance": data.balance,
            "currency": data.currency
        }
    }

@app.delete("/api/wallets/{wallet_id}")
def delete_wallet(wallet_id: int, authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id
        FROM wallets
        WHERE id = ? AND user_id = ?
    """, (wallet_id, user["id"]))

    wallet = cursor.fetchone()

    if not wallet:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    cursor.execute("""
        DELETE FROM wallets
        WHERE id = ? AND user_id = ?
    """, (wallet_id, user["id"]))

    conn.commit()
    conn.close()

    return {
        "message": "Xóa ví tiền thành công"
    }

@app.post("/api/ai/parse-transaction")
def ai_parse_transaction(data: AIParseRequest, authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Nội dung cần phân tích không được để trống")

    result = parse_transaction_text(data.text)

    return {
        "message": "AI đã xử lý câu giao dịch",
        "user_id": user["id"],
        "result": result
    }

@app.post("/api/ai/analyze")
def ai_analyze(data: AIAnalyzeRequest, authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    transactions = [
        item.model_dump()
        for item in data.transactions
    ]

    result = analyze_transactions(transactions)

    return {
        "message": "AI đã phân tích dữ liệu tài chính",
        "user_id": user["id"],
        "result": result
    }

@app.post("/api/ai/chat")
def ai_chat(data: AIChatRequest, authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    if not data.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    transactions = [
        item.model_dump()
        for item in data.transactions
    ]

    result = answer_finance_question(data.question, transactions)

    return {
        "message": "AI đã trả lời câu hỏi",
        "user_id": user["id"],
        "result": result
    }