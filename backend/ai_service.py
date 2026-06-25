import os
import re
import json
import unicodedata
from typing import Any

try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None

# =====================================================
# CẤU HÌNH GEMINI
# =====================================================
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
VALID_TYPES = ["Thu", "Chi"]
VALID_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Nhà ở",
    "Học tập",
    "Giải trí",
    "Mua sắm",
    "Y tế",
    "Gia đình",
    "Lương",
    "Thưởng",
    "Làm thêm",
    "Được cho",
    "Khác"
]

def has_gemini_api_key() -> bool:
    return bool(os.getenv("GEMINI_API_KEY")) and genai is not None and types is not None

def get_gemini_client():
    if not has_gemini_api_key():
        return None
    return genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def extract_json_from_text(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if match:
        return json.loads(match.group(0))

    raise ValueError("Không tìm thấy JSON hợp lệ trong phản hồi Gemini")

def call_gemini_json(prompt: str) -> dict[str, Any]:
    client = get_gemini_client()
    if client is None:
        raise RuntimeError("Chưa cấu hình GEMINI_API_KEY hoặc chưa cài google-genai")

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    return extract_json_from_text(response.text)

# =====================================================
# HÀM XỬ LÝ CHUNG
# =====================================================
def remove_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return text

def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = remove_accents(text)
    return text

def format_money(value: float) -> str:
    return f"{value:,.0f} VNĐ".replace(",", ".")

def standardize_transaction_type(value: Any) -> str:
    value = str(value or "").strip()
    if value in VALID_TYPES:
        return value

    normalized = normalize_text(value)

    if "thu" in normalized or "income" in normalized:
        return "Thu"

    return "Chi"

def standardize_category(value: Any, transaction_type: str = "Chi") -> str:
    value = str(value or "").strip()
    if value in VALID_CATEGORIES:
        return value

    normalized = normalize_text(value)

    mapping = {
        "an uong": "Ăn uống",
        "an": "Ăn uống",
        "do an": "Ăn uống",
        "com": "Ăn uống",
        "pho": "Ăn uống",
        "bun": "Ăn uống",
        "banh": "Ăn uống",
        "banh mi": "Ăn uống",
        "cafe": "Ăn uống",
        "ca phe": "Ăn uống",
        "tra sua": "Ăn uống",
        "nuoc": "Ăn uống",

        "di chuyen": "Di chuyển",
        "xang": "Di chuyển",
        "do xang": "Di chuyển",
        "grab": "Di chuyển",
        "taxi": "Di chuyển",
        "xe": "Di chuyển",
        "bus": "Di chuyển",
        "ve xe": "Di chuyển",
        "gui xe": "Di chuyển",

        "nha": "Nhà ở",
        "tien nha": "Nhà ở",
        "thue nha": "Nhà ở",
        "phong": "Nhà ở",
        "dien": "Nhà ở",
        "nuoc nha": "Nhà ở",
        "internet": "Nhà ở",
        "wifi": "Nhà ở",

        "hoc": "Học tập",
        "hoc tap": "Học tập",
        "hoc phi": "Học tập",
        "sach": "Học tập",
        "vo": "Học tập",
        "but": "Học tập",
        "tai lieu": "Học tập",

        "giai tri": "Giải trí",
        "phim": "Giải trí",
        "game": "Giải trí",
        "karaoke": "Giải trí",
        "netflix": "Giải trí",
        "spotify": "Giải trí",
        "di choi": "Giải trí",

        "mua sam": "Mua sắm",
        "mua": "Mua sắm",
        "ao": "Mua sắm",
        "quan": "Mua sắm",
        "giay": "Mua sắm",
        "dep": "Mua sắm",
        "shopee": "Mua sắm",
        "lazada": "Mua sắm",
        "tiki": "Mua sắm",

        "y te": "Y tế",
        "thuoc": "Y tế",
        "kham": "Y tế",
        "benh vien": "Y tế",
        "bac si": "Y tế",
        "vien phi": "Y tế",

        "gia dinh": "Gia đình",
        "bo me": "Gia đình",
        "anh chi": "Gia đình",
        "qua tang": "Gia đình",

        "luong": "Lương",
        "tien luong": "Lương",
        "nhan luong": "Lương",
        "thuong": "Thưởng",
        "bonus": "Thưởng",
        "lam them": "Làm thêm",
        "part time": "Làm thêm",
        "freelance": "Làm thêm",
        "tien cong": "Làm thêm",
        "duoc cho": "Được cho",
        "duoc tang": "Được cho",
        "bo me cho": "Được cho"
    }

    for key, category in mapping.items():
        if key in normalized:
            return category

    return "Khác"

def normalize_ai_transaction(item: dict[str, Any], original_text: str = "") -> dict[str, Any]:
    transaction_type = standardize_transaction_type(
        item.get("transaction_type") or item.get("type") or item.get("trans_type")
    )
    category = standardize_category(item.get("category"), transaction_type)

    try:
        amount = float(item.get("amount") or 0)
    except Exception:
        amount = 0

    note = item.get("note") or original_text

    try:
        confidence = float(item.get("confidence") or 0.85)
    except Exception:
        confidence = 0.85

    return {
        "transaction_type": transaction_type,
        "type": transaction_type,
        "category": category,
        "amount": amount,
        "note": note,
        "confidence": max(0, min(confidence, 1))
    }

# =====================================================
# RULE-BASED FALLBACK NÂNG CẤP BUỔI 9
# =====================================================
def split_text_to_transaction_parts(text: str) -> list[str]:
    raw = text.strip()
    raw = re.sub(r"\s+", " ", raw)

    parts = re.split(
        r",|;|\.|\n|\brồi\b|\bva\b|\bvà\b|\bsau do\b|\bsau đó\b|\bthem\b|\bthêm\b",
        raw,
        flags=re.IGNORECASE
    )

    clean_parts = []

    for part in parts:
        part = part.strip()
        if part:
            clean_parts.append(part)

    if not clean_parts:
        return [text]

    return clean_parts

def extract_amount_rule(text: str) -> float:
    raw_text = normalize_text(text)
    match_tr_compact = re.search(r"(\d+)\s*tr\s*(\d+)", raw_text)
    if match_tr_compact:
        main = int(match_tr_compact.group(1))
        decimal = int(match_tr_compact.group(2))
        return main * 1_000_000 + decimal * 100_000

    match_million = re.search(r"(\d+(?:[.,]\d+)?)\s*(trieu|tr|trieu dong)", raw_text)
    if match_million:
        number = match_million.group(1).replace(",", ".")
        return float(number) * 1_000_000

    match_thousand = re.search(r"(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan)", raw_text)
    if match_thousand:
        number = match_thousand.group(1).replace(",", ".")
        return float(number) * 1_000

    match_number = re.search(r"\d[\d.]*", raw_text)

    if match_number:
        number = match_number.group(0).replace(".", "")
        return float(number)

    return 0

def detect_transaction_type_rule(text: str) -> str:
    normalized = normalize_text(text)
    income_keywords = [
        "luong",
        "thuong",
        "thu nhap",
        "lam them",
        "duoc cho",
        "duoc tang",
        "nhan tien",
        "nhan luong",
        "tien luong",
        "phu cap",
        "hoc bong",
        "ban hang",
        "tien cong",
        "lai ngan hang"
    ]

    for keyword in income_keywords:
        if keyword in normalized:
            return "Thu"

    return "Chi"

def detect_category_rule(text: str, transaction_type: str) -> str:
    normalized = normalize_text(text)
    if transaction_type == "Thu":
        income_category_keywords = {
            "Lương": ["luong", "tien luong", "nhan luong"],
            "Thưởng": ["thuong", "bonus"],
            "Làm thêm": ["lam them", "freelance", "part time", "tien cong"],
            "Được cho": ["duoc cho", "duoc tang", "bo me cho"],
            "Khác": []
        }

        for category, keywords in income_category_keywords.items():
            for keyword in keywords:
                if keyword in normalized:
                    return category

        return "Khác"

    expense_category_keywords = {
        "Ăn uống": [
            "an", "com", "bun", "pho", "banh", "banh mi", "sang", "trua", "toi",
            "cafe", "ca phe", "tra sua", "nuoc", "do an", "an vat", "uong"
        ],
        "Di chuyển": [
            "xang", "grab", "taxi", "xe", "bus", "gui xe", "di chuyen",
            "ve xe", "do xang"
        ],
        "Nhà ở": [
            "tien nha", "thue nha", "phong", "dien", "nuoc nha", "internet",
            "wifi", "nha tro"
        ],
        "Học tập": [
            "hoc", "hoc phi", "sach", "vo", "but", "khoa hoc", "tai lieu"
        ],
        "Giải trí": [
            "phim", "game", "giai tri", "netflix", "spotify", "karaoke",
            "du lich", "di choi"
        ],
        "Mua sắm": [
            "mua", "ao", "quan", "giay", "dep", "shopee", "lazada",
            "tiki", "do dung"
        ],
        "Y tế": [
            "thuoc", "benh", "kham", "vien phi", "bac si", "y te",
            "benh vien"
        ],
        "Gia đình": [
            "bo me", "gia dinh", "em", "anh", "chi", "qua tang"
        ],
        "Khác": []
    }

    for category, keywords in expense_category_keywords.items():
        for keyword in keywords:
            if keyword in normalized:
                return category

    return "Khác"

def parse_single_transaction_rule(part: str) -> dict[str, Any] | None:
    amount = extract_amount_rule(part)
    if amount <= 0:
        return None

    transaction_type = detect_transaction_type_rule(part)
    category = detect_category_rule(part, transaction_type)

    return {
        "transaction_type": transaction_type,
        "type": transaction_type,
        "category": category,
        "amount": amount,
        "note": part.strip(),
        "confidence": 0.75
    }

def parse_multiple_transactions_rule(text: str) -> list[dict[str, Any]]:
    parts = split_text_to_transaction_parts(text)
    transactions = []
    
    for part in parts:
        transaction = parse_single_transaction_rule(part)

        if transaction:
            transactions.append(transaction)

    if not transactions:
        single = parse_single_transaction_rule(text)

        if single:
            transactions.append(single)

    return transactions

def parse_transaction_text_rule(text: str) -> dict[str, Any]:
    transactions = parse_multiple_transactions_rule(text)
    
    if not transactions:
        return {
            "is_valid": False,
            "transaction_type": "Chi",
            "category": "Khác",
            "amount": 0,
            "note": text,
            "confidence": 0.35,
            "explanation": "AI rule-based chưa nhận diện được số tiền trong câu nhập.",
            "transactions": [],
            "transaction_count": 0,
            "ai_engine": "rule_based"
        }

    first = transactions[0]

    if len(transactions) == 1:
        explanation = (
            f"AI rule-based đã hiểu đây là giao dịch {first['transaction_type']}, "
            f"danh mục {first['category']}, số tiền {format_money(first['amount'])}."
        )
    else:
        explanation = f"AI rule-based đã tách được {len(transactions)} giao dịch từ câu nhập."

    return {
        "is_valid": True,
        "transaction_type": first["transaction_type"],
        "category": first["category"],
        "amount": first["amount"],
        "note": text,
        "confidence": first["confidence"],
        "explanation": explanation,
        "transactions": transactions,
        "transaction_count": len(transactions),
        "ai_engine": "rule_based"
    }

# =====================================================
# GEMINI: BÓC TÁCH GIAO DỊCH NGÔN NGỮ TỰ NHIÊN
# =====================================================
def parse_transaction_text_gemini(text: str) -> dict[str, Any]:
    prompt = f"""
    Bạn là trợ lý AI quản lý tài chính cá nhân trong một website quản lý thu chi.
    Nhiệm vụ:
    Phân tích câu nhập tự nhiên của người dùng và trích xuất giao dịch tài chính.
    Câu người dùng:
    {text}
    Yêu cầu:

    Trả về DUY NHẤT JSON hợp lệ.
    Không viết markdown.
    Không giải thích ngoài JSON.
    Nếu câu có nhiều giao dịch, hãy tách thành nhiều phần tử trong mảng "transactions".
    Nếu câu chỉ có một giao dịch, mảng "transactions" vẫn phải có 1 phần tử.
    Hiểu tiếng Việt có dấu và không dấu.
    Hiểu các cách viết tiền: 30k, 30 nghìn, 120 ngan, 1 triệu, 1tr, 1tr5, 2.000.000, 500000.
    Đơn vị amount luôn là VND.
    Nếu không tìm thấy số tiền thì is_valid=false.
    Danh mục hợp lệ:
    ["Ăn uống","Di chuyển","Nhà ở","Học tập","Giải trí","Mua sắm","Y tế","Gia đình","Lương","Thưởng","Làm thêm","Được cho","Khác"]
    Loại giao dịch hợp lệ:
    ["Thu","Chi"]
    Quy tắc phân loại:

    Nhận lương, thưởng, làm thêm, được cho tiền, bán hàng, học bổng là "Thu".
    Ăn uống, đi lại, mua sắm, giải trí, học tập, y tế, nhà ở, gia đình là "Chi".
    Nếu không chắc danh mục thì dùng "Khác".
    Không tự bịa số tiền nếu câu không có số tiền.
    Schema JSON bắt buộc:
    {{
    "is_valid": true,
    "transaction_type": "Thu hoặc Chi của giao dịch đầu tiên",
    "category": "danh mục của giao dịch đầu tiên",
    "amount": 0,
    "note": "câu gốc của người dùng",
    "confidence": 0.0,
    "explanation": "giải thích ngắn bằng tiếng Việt",
    "transactions": [
    {{
    "transaction_type": "Thu hoặc Chi",
    "category": "danh mục hợp lệ",
    "amount": 0,
    "note": "ghi chú riêng cho giao dịch này",
    "confidence": 0.0
    }}
    ]
    }}
    Ví dụ:
    Câu: "Sáng ăn bánh mì 30k, trưa uống trà sữa 40k, tối nhận lương 5 triệu"
    Kết quả mong muốn:
    3 giao dịch
    Ăn uống 30000
    Ăn uống 40000
    Lương 5000000
    """
    result = call_gemini_json(prompt)
    raw_transactions = result.get("transactions") or []
    
    if not isinstance(raw_transactions, list):
        raw_transactions = []
        
    transactions = [
        normalize_ai_transaction(item, text)
        for item in raw_transactions
        if isinstance(item, dict)
    ]
    
    transactions = [
        item for item in transactions
        if item["amount"] > 0
    ]
    
    if not transactions:
        amount = float(result.get("amount") or 0)
        if amount > 0:
            transaction_type = standardize_transaction_type(result.get("transaction_type"))
            category = standardize_category(result.get("category"), transaction_type)

            transactions = [
                {
                    "transaction_type": transaction_type,
                    "type": transaction_type,
                    "category": category,
                    "amount": amount,
                    "note": result.get("note") or text,
                    "confidence": float(result.get("confidence") or 0.85)
                }
            ]
            
    is_valid = bool(transactions)
    
    if is_valid:
        first = transactions[0]
        transaction_type = first["transaction_type"]
        category = first["category"]
        amount = first["amount"]
        confidence = first["confidence"]
    else:
        transaction_type = "Chi"
        category = "Khác"
        amount = 0
        confidence = 0.2
        
    explanation = result.get("explanation")
    
    if not explanation:
        if is_valid and len(transactions) == 1:
            explanation = (
                f"Gemini đã hiểu 1 giao dịch {transaction_type}, "
                f"danh mục {category}, số tiền {format_money(amount)}."
            )
        elif is_valid:
            explanation = f"Gemini đã tách được {len(transactions)} giao dịch từ câu nhập."
        else:
            explanation = "Gemini chưa nhận diện được giao dịch hợp lệ."
            
    return {
        "is_valid": is_valid,
        "transaction_type": transaction_type,
        "category": category,
        "amount": amount,
        "note": result.get("note") or text,
        "confidence": confidence,
        "explanation": explanation,
        "transactions": transactions,
        "transaction_count": len(transactions),
        "ai_engine": "gemini"
    }

def parse_transaction_text(text: str) -> dict[str, Any]:
    if has_gemini_api_key():
        try:
            return parse_transaction_text_gemini(text)
        except Exception as error:
            fallback = parse_transaction_text_rule(text)
            fallback["explanation"] = (
                f"Gemini gặp lỗi nên hệ thống chuyển sang rule-based. "
                f"{fallback['explanation']}"
            )
            fallback["gemini_error"] = str(error)
            return fallback
    return parse_transaction_text_rule(text)

# =====================================================
# PHÂN TÍCH GIAO DỊCH
# =====================================================
def normalize_transaction_item(item: dict[str, Any]) -> dict[str, Any]:
    transaction_type = item.get("type") or item.get("trans_type") or item.get("transaction_type") or "Chi"
    transaction_type = standardize_transaction_type(transaction_type)
    return {
        "type": transaction_type,
        "transaction_type": transaction_type,
        "category": standardize_category(item.get("category") or "Khác", transaction_type),
        "amount": float(item.get("amount") or 0),
        "note": item.get("note") or "",
        "date": item.get("date") or item.get("trans_date") or ""
    }

def analyze_transactions_rule(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_transactions = [
        normalize_transaction_item(item)
        for item in transactions
    ]
    
    if not normalized_transactions:
        return {
            "summary": {
                "income": 0,
                "expense": 0,
                "balance": 0,
                "saving_rate": 0,
                "transaction_count": 0
            },
            "top_category": None,
            "analysis": "Chưa có dữ liệu giao dịch để phân tích. Hãy thêm một vài khoản thu và chi trước.",
            "suggestions": [
                "Nên ghi chép giao dịch hằng ngày.",
                "Nên đặt ngân sách cho các nhóm chi tiêu quan trọng.",
                "Nên theo dõi tổng thu, tổng chi và số dư theo tháng."
            ],
            "ai_engine": "rule_based"
        }

    income = sum(item["amount"] for item in normalized_transactions if item["type"] == "Thu")
    expense = sum(item["amount"] for item in normalized_transactions if item["type"] == "Chi")
    balance = income - expense

    saving_rate = 0

    if income > 0:
        saving_rate = (balance / income) * 100

    expense_by_category: dict[str, float] = {}

    for item in normalized_transactions:
        if item["type"] == "Chi":
            category = item["category"]
            expense_by_category[category] = expense_by_category.get(category, 0) + item["amount"]

    top_category = None

    if expense_by_category:
        top_category_name = max(expense_by_category, key=expense_by_category.get)

        top_category = {
            "category": top_category_name,
            "amount": expense_by_category[top_category_name]
        }

    messages = []

    messages.append(
        f"Tổng thu hiện tại là {format_money(income)}, "
        f"tổng chi là {format_money(expense)}, "
        f"số dư còn lại là {format_money(balance)}."
    )

    if income > 0:
        spending_ratio = (expense / income) * 100

        if spending_ratio <= 50:
            messages.append(
                f"Tỷ lệ chi tiêu là {spending_ratio:.1f}%, đây là mức khá an toàn."
            )
        elif spending_ratio <= 80:
            messages.append(
                f"Tỷ lệ chi tiêu là {spending_ratio:.1f}%, vẫn trong mức kiểm soát nhưng cần tiếp tục theo dõi."
            )
        else:
            messages.append(
                f"Tỷ lệ chi tiêu là {spending_ratio:.1f}%, mức này khá cao so với thu nhập."
            )
    else:
        messages.append("Hiện chưa có dữ liệu thu nhập nên chưa thể đánh giá tỷ lệ chi tiêu.")

    if top_category:
        messages.append(
            f"Danh mục chi nhiều nhất là {top_category['category']}, "
            f"với tổng số tiền {format_money(top_category['amount'])}."
        )

    if saving_rate > 20:
        messages.append(f"Tỷ lệ tiết kiệm là {saving_rate:.1f}%, đây là mức khá tốt.")
    elif saving_rate > 0:
        messages.append(f"Tỷ lệ tiết kiệm là {saving_rate:.1f}%, vẫn còn tiết kiệm nhưng chưa cao.")
    else:
        messages.append("Số dư hiện tại chưa dương, cần kiểm soát lại chi tiêu.")

    suggestions = [
        "Ghi chép giao dịch thường xuyên để dữ liệu phân tích chính xác hơn.",
        "Đặt ngân sách cho các danh mục như Ăn uống, Giải trí và Mua sắm.",
        "Theo dõi biểu đồ thu chi hằng tuần để phát hiện khoản chi bất thường."
    ]

    return {
        "summary": {
            "income": income,
            "expense": expense,
            "balance": balance,
            "saving_rate": saving_rate,
            "transaction_count": len(normalized_transactions)
        },
        "top_category": top_category,
        "analysis": " ".join(messages),
        "suggestions": suggestions,
        "ai_engine": "rule_based"
    }

def analyze_transactions_gemini(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    base_result = analyze_transactions_rule(transactions)
    prompt = f"""
    Bạn là trợ lý AI tài chính cá nhân.
    Dữ liệu giao dịch:
    {json.dumps(transactions, ensure_ascii=False)}
    Số liệu đã tính:
    {json.dumps(base_result["summary"], ensure_ascii=False)}
    Danh mục chi nhiều nhất:
    {json.dumps(base_result["top_category"], ensure_ascii=False)}
    Hãy viết nhận xét tài chính cá nhân bằng tiếng Việt, ngắn gọn, dễ hiểu, phù hợp với sinh viên.
    Yêu cầu trả về DUY NHẤT JSON hợp lệ:
    {{
    "analysis": "đoạn nhận xét 4-6 câu",
    "suggestions": ["gợi ý 1", "gợi ý 2", "gợi ý 3"]
    }}
    """
    result = call_gemini_json(prompt)

    base_result["analysis"] = result.get("analysis") or base_result["analysis"]
    base_result["suggestions"] = result.get("suggestions") or base_result["suggestions"]
    base_result["ai_engine"] = "gemini"

    return base_result

def analyze_transactions(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    if has_gemini_api_key():
        try:
            return analyze_transactions_gemini(transactions)
        except Exception as error:
            result = analyze_transactions_rule(transactions)
            result["gemini_error"] = str(error)
            return result
    return analyze_transactions_rule(transactions)

# =====================================================
# HỎI ĐÁP TÀI CHÍNH
# =====================================================
def answer_finance_question_rule(question: str, transactions: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_question = normalize_text(question)
    analysis_result = analyze_transactions_rule(transactions)
    summary = analysis_result["summary"]
    top_category = analysis_result["top_category"]
    
    if "tong thu" in normalized_question or "thu nhap" in normalized_question:
        answer = f"Tổng thu hiện tại của bạn là {format_money(summary['income'])}."
    elif "tong chi" in normalized_question or "chi tieu" in normalized_question:
        answer = f"Tổng chi hiện tại của bạn là {format_money(summary['expense'])}."
    elif "so du" in normalized_question or "con lai" in normalized_question:
        answer = f"Số dư hiện tại của bạn là {format_money(summary['balance'])}."
    elif "chi nhieu nhat" in normalized_question or "danh muc" in normalized_question:
        if top_category:
            answer = (
                f"Danh mục chi nhiều nhất là {top_category['category']}, "
                f"với tổng số tiền {format_money(top_category['amount'])}."
            )
        else:
            answer = "Hiện chưa có khoản chi nào để xác định danh mục chi nhiều nhất."
    elif "tiet kiem" in normalized_question:
        saving_rate = summary["saving_rate"]

        if summary["income"] <= 0:
            answer = "Chưa có dữ liệu thu nhập nên chưa thể tính tỷ lệ tiết kiệm."
        elif saving_rate > 20:
            answer = f"Tỷ lệ tiết kiệm hiện tại là {saving_rate:.1f}%. Đây là mức khá tốt."
        elif saving_rate > 0:
            answer = f"Tỷ lệ tiết kiệm hiện tại là {saving_rate:.1f}%. Bạn vẫn còn tiết kiệm nhưng nên tối ưu thêm chi tiêu."
        else:
            answer = "Hiện tại bạn chưa có tiết kiệm vì chi tiêu đang bằng hoặc vượt thu nhập."
    else:
        answer = analysis_result["analysis"]

    return {
        "question": question,
        "answer": answer,
        "summary": summary,
        "ai_engine": "rule_based"
    }

def answer_finance_question_gemini(question: str, transactions: list[dict[str, Any]]) -> dict[str, Any]:
    analysis_result = analyze_transactions_rule(transactions)
    prompt = f"""
    Bạn là trợ lý AI quản lý tài chính cá nhân.
    Câu hỏi của người dùng:
    {question}
    Dữ liệu giao dịch:
    {json.dumps(transactions, ensure_ascii=False)}
    Số liệu tổng hợp:
    {json.dumps(analysis_result["summary"], ensure_ascii=False)}
    Danh mục chi nhiều nhất:
    {json.dumps(analysis_result["top_category"], ensure_ascii=False)}
    Hãy trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt tự nhiên.
    Yêu cầu trả về DUY NHẤT JSON hợp lệ:
    {{
    "answer": "câu trả lời cho người dùng"
    }}
    """
    result = call_gemini_json(prompt)

    return {
        "question": question,
        "answer": result.get("answer") or analysis_result["analysis"],
        "summary": analysis_result["summary"],
        "ai_engine": "gemini"
    }

def answer_finance_question(question: str, transactions: list[dict[str, Any]]) -> dict[str, Any]:
    if has_gemini_api_key():
        try:
            return answer_finance_question_gemini(question, transactions)
        except Exception as error:
            result = answer_finance_question_rule(question, transactions)
            result["gemini_error"] = str(error)
            return result
    return answer_finance_question_rule(question, transactions)