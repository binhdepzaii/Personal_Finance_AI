const API_BASE_URL = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" ? "http://127.0.0.1:8000" : "https://personal-finance-ai-backend.onrender.com";
const STORAGE_KEY = "personal_finance_transactions";
const USER_KEY = "personal_finance_user";
const TOKEN_KEY = "personal_finance_token";

let categoryChart = null;
let trendChart = null;
let reportCategoryChart = null;
let reportTrendChart = null;
let aiAnalysisCache = {
    signature: null,
    text: null,
    engine: null
};

const expenseCategories = [
    "Ăn uống",
    "Di chuyển",
    "Nhà ở",
    "Học tập",
    "Giải trí",
    "Mua sắm",
    "Y tế",
    "Gia đình",
    "Khác"
];

const incomeCategories = [
    "Lương",
    "Thưởng",
    "Làm thêm",
    "Được cho",
    "Khác"
];

const sectionInfo = {
    "overview-section": {
        title: "Tổng quan tài chính",
        subtitle: "Theo dõi nhanh tình hình thu chi, số dư và tỷ lệ tiết kiệm"
    },
    "wallet-section": {
        title: "Quản lý ví tiền",
        subtitle: "Tạo, xem và xóa ví tiền từ cơ sở dữ liệu SQLite thông qua Backend API"
    },
    "transaction-section": {
        title: "Quản lý giao dịch",
        subtitle: "Ghi nhận các khoản thu chi và theo dõi lịch sử giao dịch"
    },
    "chart-section": {
        title: "Biểu đồ tài chính",
        subtitle: "Trực quan hóa chi tiêu theo danh mục và biến động thu chi theo ngày"
    },
    "assistant-section": {
        title: "Trợ lý AI tài chính",
        subtitle: "Phân tích tài chính cá nhân và xử lý giao dịch bằng ngôn ngữ tự nhiên"
    },
    "report-section": {
        title: "Báo cáo tài chính",
        subtitle: "Tổng hợp dữ liệu thu chi, biểu đồ, thống kê và xuất báo cáo"
    }
};

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    if (options.body && typeof options.body !== "string") {
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        const errorMessage = data.detail || data.message || `Lỗi API ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }

    return data;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " VNĐ";
}

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

function getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
}

function getTransactions() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveTransactions(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getTransactionSignature(data) {
    const cleanData = data.map(item => ({
        id: item.id,
        date: item.date,
        type: item.type,
        category: item.category,
        amount: Number(item.amount || 0),
        note: item.note || ""
    }));
    return JSON.stringify(cleanData);
}

function invalidateAIAnalysisCache() {
    aiAnalysisCache = {
        signature: null,
        text: null,
        engine: null
    };
}

function setAIAnalysisText(text) {
    const aiBox = document.getElementById("aiAnalysis");
    const aiBoxOverview = document.getElementById("aiAnalysisOverview");
    if (aiBox) aiBox.textContent = text;
    if (aiBoxOverview) aiBoxOverview.textContent = text;
}

function seedDemoData() {
    const oldData = getTransactions();
    if (oldData.length > 0) return;

    const demoData = [
        {
            id: Date.now() + 1,
            date: getToday(),
            type: "Thu",
            category: "Lương",
            amount: 6500000,
            note: "Lương tháng"
        },
        {
            id: Date.now() + 2,
            date: getToday(),
            type: "Chi",
            category: "Ăn uống",
            amount: 120000,
            note: "Ăn trưa và cà phê"
        },
        {
            id: Date.now() + 3,
            date: getToday(),
            type: "Chi",
            category: "Di chuyển",
            amount: 70000,
            note: "Xăng xe"
        },
        {
            id: Date.now() + 4,
            date: getToday(),
            type: "Chi",
            category: "Giải trí",
            amount: 250000,
            note: "Xem phim cuối tuần"
        }
    ];

    saveTransactions(demoData);
}

function initDashboardNavigation() {
    const navButtons = document.querySelectorAll(".dashboard-nav");
    navButtons.forEach(button => {
        button.addEventListener("click", function () {
            const target = this.dataset.target;
            showDashboardSection(target);
        });
    });
}

function showDashboardSection(sectionId) {
    const sections = document.querySelectorAll(".dashboard-section");
    const navButtons = document.querySelectorAll(".dashboard-nav");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    
    sections.forEach(section => {
        section.classList.add("hidden");
    });

    const selectedSection = document.getElementById(sectionId);

    if (selectedSection) {
        selectedSection.classList.remove("hidden");
    }

    navButtons.forEach(button => {
        if (button.dataset.target === sectionId) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    if (sectionInfo[sectionId]) {
        if (pageTitle) pageTitle.textContent = sectionInfo[sectionId].title;
        if (pageSubtitle) pageSubtitle.textContent = sectionInfo[sectionId].subtitle;
    }

    if (sectionId === "chart-section") {
        renderCharts(getTransactions());
    }

    if (sectionId === "wallet-section") {
        loadWallets();
    }

    if (sectionId === "overview-section" || sectionId === "assistant-section") {
        renderAIAnalysis(getTransactions());
    }

    if (sectionId === "report-section") {
        renderReport();
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!name || !email || !password) {
        alert("Vui lòng nhập đầy đủ thông tin.");
        return;
    }

    try {
        await apiRequest("/api/auth/register", {
            method: "POST",
            body: {
                full_name: name,
                email,
                password
            }
        });

        alert("Đăng ký tài khoản thành công. Chuyển sang trang đăng nhập.");
        window.location.href = "./login.html";
    } catch (error) {
        alert(error.message);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
        alert("Vui lòng nhập email và mật khẩu.");
        return;
    }

    try {
        const result = await apiRequest("/api/auth/login", {
            method: "POST",
            body: {
                email,
                password
            }
        });

        setToken(result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));

        window.location.replace("dashboard.html");
    } catch (error) {
        alert(error.message);
    }
}

async function logout() {
    try {
        if (getToken()) {
            await apiRequest("/api/auth/logout", {
                method: "POST"
            });
        }
    } catch {
        // Bỏ qua lỗi khi logout
    }
    clearAuth();
    window.location.href = "./login.html";
}

async function loadCurrentUser() {
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    
    if (!getToken()) {
        alert("Bạn cần đăng nhập để truy cập Dashboard.");
        window.location.href = "./login.html";
        return null;
    }

    try {
        const result = await apiRequest("/api/auth/me", {
            method: "GET"
        });

        const user = result.user;
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        if (userName) userName.textContent = user.full_name || "Người dùng";
        if (userEmail) userEmail.textContent = user.email || "";

        return user;
    } catch (error) {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        clearAuth();
        window.location.href = "./login.html";
        return null;
    }
}

function updateCategoryOptions() {
    const typeSelect = document.getElementById("transactionType");
    const categorySelect = document.getElementById("transactionCategory");
    if (!typeSelect || !categorySelect) return;

    const selectedType = typeSelect.value;
    const list = selectedType === "Thu" ? incomeCategories : expenseCategories;

    categorySelect.innerHTML = "";

    list.forEach(item => {
        const option = document.createElement("option");
        option.value = item;
        option.textContent = item;
        categorySelect.appendChild(option);
    });
}

function handleAddTransaction(event) {
    event.preventDefault();
    const date = document.getElementById("transactionDate").value;
    const type = document.getElementById("transactionType").value;
    const category = document.getElementById("transactionCategory").value;
    const amount = Number(document.getElementById("transactionAmount").value);
    const note = document.getElementById("transactionNote").value.trim();

    if (!date || !type || !category || amount <= 0) {
        alert("Vui lòng nhập đầy đủ thông tin và số tiền phải lớn hơn 0.");
        return;
    }

    const data = getTransactions();

    data.push({
        id: Date.now(),
        date,
        type,
        category,
        amount,
        note
    });

    saveTransactions(data);
    invalidateAIAnalysisCache();

    event.target.reset();

    const dateInput = document.getElementById("transactionDate");
    if (dateInput) dateInput.value = getToday();

    updateCategoryOptions();
    renderDashboard();

    setAIAnalysisText("Dữ liệu giao dịch vừa thay đổi. Mở mục Tổng quan hoặc Trợ lý AI để hệ thống phân tích lại khi cần.");
}

function deleteTransaction(id) {
    const data = getTransactions().filter(item => item.id !== id);
    saveTransactions(data);
    invalidateAIAnalysisCache();
    renderDashboard();
    setAIAnalysisText("Dữ liệu giao dịch vừa thay đổi. Mở mục Tổng quan hoặc Trợ lý AI để hệ thống phân tích lại khi cần.");
}

function calculateSummary(data) {
    const income = data
        .filter(item => item.type === "Thu")
        .reduce((sum, item) => sum + Number(item.amount), 0);
        
    const expense = data
        .filter(item => item.type === "Chi")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const balance = income - expense;
    const savingRate = income > 0 ? (balance / income) * 100 : 0;

    return { income, expense, balance, savingRate };
}

function renderSummary(data) {
    const summary = calculateSummary(data);
    const totalIncome = document.getElementById("totalIncome");
    const totalExpense = document.getElementById("totalExpense");
    const totalBalance = document.getElementById("totalBalance");
    const savingRate = document.getElementById("savingRate");

    if (totalIncome) totalIncome.textContent = formatMoney(summary.income);
    if (totalExpense) totalExpense.textContent = formatMoney(summary.expense);
    if (totalBalance) totalBalance.textContent = formatMoney(summary.balance);
    if (savingRate) savingRate.textContent = summary.savingRate.toFixed(1) + "%";
}

function renderTransactionTable(data) {
    const tbody = document.getElementById("transactionTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-slate-500 py-8">
                    Chưa có giao dịch nào.
                </td>
            </tr>
        `;
        return;
    }

    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedData.forEach(item => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${new Date(item.date).toLocaleDateString("vi-VN")}</td>
            <td>
                <span class="${item.type === "Thu" ? "badge-income" : "badge-expense"}">
                    ${escapeHTML(item.type)}
                </span>
            </td>
            <td>${escapeHTML(item.category)}</td>
            <td class="font-bold ${item.type === "Thu" ? "text-green-600" : "text-red-600"}">
                ${item.type === "Thu" ? "+" : "-"}${formatMoney(item.amount)}
            </td>
            <td>${escapeHTML(item.note || "Không có ghi chú")}</td>
            <td>
                <button class="btn-danger" onclick="deleteTransaction(${item.id})">
                    Xóa
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function groupExpenseByCategory(data) {
    const result = {};
    data.filter(item => item.type === "Chi").forEach(item => {
        if (!result[item.category]) result[item.category] = 0;
        result[item.category] += Number(item.amount);
    });

    return result;
}

function groupByDate(data) {
    const result = {};
    data.forEach(item => {
        if (!result[item.date]) {
            result[item.date] = { Thu: 0, Chi: 0 };
        }

        result[item.date][item.type] += Number(item.amount);
    });

    return result;
}

function groupByMonth(data) {
    const result = {};
    data.forEach(item => {
        const month = String(item.date || "").slice(0, 7) || "Không rõ";

        if (!result[month]) {
            result[month] = {
                Thu: 0,
                Chi: 0,
                count: 0
            };
        }

        result[month][item.type] += Number(item.amount || 0);
        result[month].count += 1;
    });

    return result;
}

function renderCharts(data) {
    const categoryCanvas = document.getElementById("categoryChart");
    const trendCanvas = document.getElementById("trendChart");
    if (!categoryCanvas || !trendCanvas || typeof Chart === "undefined") return;

    const categoryData = groupExpenseByCategory(data);
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(categoryCanvas, {
        type: "doughnut",
        data: {
            labels: categoryLabels.length ? categoryLabels : ["Chưa có dữ liệu"],
            datasets: [{
                data: categoryValues.length ? categoryValues : [1],
                backgroundColor: [
                    "#2563eb",
                    "#06b6d4",
                    "#22c55e",
                    "#f97316",
                    "#ef4444",
                    "#a855f7",
                    "#14b8a6",
                    "#eab308",
                    "#64748b"
                ],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    const byDate = groupByDate(data);
    const labels = Object.keys(byDate).sort();
    const incomeValues = labels.map(date => byDate[date].Thu);
    const expenseValues = labels.map(date => byDate[date].Chi);

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(trendCanvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Thu",
                    data: incomeValues,
                    borderColor: "#22c55e",
                    backgroundColor: "rgba(34, 197, 94, 0.12)",
                    tension: 0.35,
                    fill: true
                },
                {
                    label: "Chi",
                    data: expenseValues,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    tension: 0.35,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function loadWallets() {
    const tbody = document.getElementById("walletTableBody");
    const walletStatus = document.getElementById("walletStatus");
    if (!tbody) return;

    try {
        const result = await apiRequest("/api/wallets", {
            method: "GET"
        });

        const wallets = result.wallets || [];

        if (walletStatus) {
            walletStatus.textContent = "Đã tải dữ liệu ví từ Backend API thành công.";
        }

        if (wallets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-slate-500 py-8">
                        Chưa có ví nào.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = "";

        wallets.forEach(wallet => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${wallet.id}</td>
                <td class="font-bold">${escapeHTML(wallet.wallet_name)}</td>
                <td class="font-bold text-blue-600">${formatMoney(wallet.balance)}</td>
                <td>${escapeHTML(wallet.currency)}</td>
                <td>${escapeHTML(wallet.created_at || "")}</td>
                <td>
                    <button class="btn-danger" onclick="deleteWallet(${wallet.id})">
                        Xóa
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-red-500 py-8">
                    Không thể tải danh sách ví. ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

async function handleWalletForm(event) {
    event.preventDefault();
    const walletName = document.getElementById("walletName").value.trim();
    const walletBalance = Number(document.getElementById("walletBalance").value || 0);
    const walletCurrency = document.getElementById("walletCurrency").value;

    if (!walletName) {
        alert("Tên ví không được để trống.");
        return;
    }

    try {
        await apiRequest("/api/wallets", {
            method: "POST",
            body: {
                wallet_name: walletName,
                balance: walletBalance,
                currency: walletCurrency
            }
        });

        alert("Tạo ví thành công.");
        event.target.reset();
        await loadWallets();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteWallet(walletId) {
    const confirmDelete = confirm("Bạn có chắc muốn xóa ví này không?");
    if (!confirmDelete) return;

    try {
        await apiRequest(`/api/wallets/${walletId}`, {
            method: "DELETE"
        });

        alert("Xóa ví thành công.");
        await loadWallets();
    } catch (error) {
        alert(error.message);
    }
}

function generateAIAnalysisFallback(data) {
    if (data.length === 0) {
        return "Chưa có dữ liệu giao dịch. Bạn hãy thêm một vài khoản thu và chi để trợ lý AI có thể phân tích tình hình tài chính.";
    }
    const summary = calculateSummary(data);
    const expenseByCategory = groupExpenseByCategory(data);
    const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

    let message = `Trong dữ liệu hiện tại, tổng thu là ${formatMoney(summary.income)}, tổng chi là ${formatMoney(summary.expense)}, số dư còn lại là ${formatMoney(summary.balance)}. `;

    if (sortedCategories.length > 0) {
        const [topCategory, topAmount] = sortedCategories[0];
        message += `Danh mục chi nhiều nhất là ${topCategory}, với tổng số tiền ${formatMoney(topAmount)}. `;
    }

    message += "Gợi ý: nên ghi chép giao dịch hằng ngày, kiểm tra biểu đồ mỗi tuần và đặt mục tiêu tiết kiệm tối thiểu 10-20% thu nhập.";

    return message;
}

function buildAIAnalysisText(aiResult) {
    let text = aiResult.analysis || "AI chưa trả về nội dung phân tích.";
    if (Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0) {
        text += "\n\nGợi ý:";
        aiResult.suggestions.forEach(item => {
            text += `\n- ${item}`;
        });
    }

    if (aiResult.ai_engine) {
        const engineName = aiResult.ai_engine === "gemini" ? "Gemini API" : "Rule-based fallback";
        text += `\n\nNguồn xử lý: ${engineName}`;
    }

    return text;
}

async function getAIAnalysisFromBackend(data) {
    const response = await apiRequest("/api/ai/analyze", {
        method: "POST",
        body: {
            transactions: data
        }
    });
    return response.result;
}

async function getAIChatAnswerFromBackend(question, data) {
    const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        body: {
            question,
            transactions: data
        }
    });
    return response.result;
}

async function parseTransactionByAI(text) {
    const response = await apiRequest("/api/ai/parse-transaction", {
        method: "POST",
        body: {
            text
        }
    });
    return response.result;
}

async function renderAIAnalysis(data) {
    const signature = getTransactionSignature(data);
    
    if (data.length === 0) {
        const text = generateAIAnalysisFallback(data);
        setAIAnalysisText(text);
        return;
    }

    if (aiAnalysisCache.signature === signature && aiAnalysisCache.text) {
        setAIAnalysisText(aiAnalysisCache.text);
        return;
    }

    setAIAnalysisText("AI Backend đang phân tích dữ liệu tài chính...");

    try {
        const aiResult = await getAIAnalysisFromBackend(data);
        const text = buildAIAnalysisText(aiResult);

        aiAnalysisCache = {
            signature,
            text,
            engine: aiResult.ai_engine || null
        };

        setAIAnalysisText(text);
    } catch (error) {
        const fallbackText = generateAIAnalysisFallback(data);

        aiAnalysisCache = {
            signature,
            text: fallbackText,
            engine: "frontend_fallback"
        };

        setAIAnalysisText(fallbackText);
    }
}

async function handleAIQuestion(event) {
    event.preventDefault();
    const input = document.getElementById("aiQuestion");
    const chatBox = document.getElementById("aiChatBox");

    if (!input || !chatBox) return;

    const question = input.value.trim();

    if (!question) {
        alert("Vui lòng nhập câu hỏi cho trợ lý AI.");
        return;
    }

    const data = getTransactions();

    chatBox.innerHTML += `
        <div class="user-message mb-3">
            <b>Bạn:</b> ${escapeHTML(question)}
        </div>
        <div class="ai-message mb-3">
            <b>AI:</b> Đang gửi câu hỏi tới AI Backend...
        </div>
    `;

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const aiResult = await getAIChatAnswerFromBackend(question, data);
        const answer = aiResult.answer || "AI chưa có câu trả lời phù hợp.";
        const engineName = aiResult.ai_engine === "gemini" ? "Gemini API" : "Rule-based fallback";

        const aiMessages = chatBox.querySelectorAll(".ai-message");
        const lastAiMessage = aiMessages[aiMessages.length - 1];

        if (lastAiMessage) {
            lastAiMessage.innerHTML = `
                <b>AI:</b> ${escapeHTML(answer)}
                <div class="text-xs text-slate-500 mt-1">Nguồn xử lý: ${engineName}</div>
            `;
        }
    } catch (error) {
        const aiMessages = chatBox.querySelectorAll(".ai-message");
        const lastAiMessage = aiMessages[aiMessages.length - 1];

        if (lastAiMessage) {
            lastAiMessage.innerHTML = `<b>AI:</b> Không thể kết nối AI Backend. ${escapeHTML(error.message)}`;
        }
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

function normalizeAITransactions(aiResult, originalText) {
    if (Array.isArray(aiResult.transactions) && aiResult.transactions.length > 0) {
        return aiResult.transactions
            .filter(item => Number(item.amount || 0) > 0)
            .map(item => ({
                type: item.type || item.transaction_type || aiResult.transaction_type || "Chi",
                category: item.category || aiResult.category || "Khác",
                amount: Number(item.amount || 0),
                note: item.note || originalText
            }));
    }
    
    if (aiResult.is_valid && Number(aiResult.amount || 0) > 0) {
        return [
            {
                type: aiResult.transaction_type || "Chi",
                category: aiResult.category || "Khác",
                amount: Number(aiResult.amount || 0),
                note: aiResult.note || originalText
            }
        ];
    }

    return [];
}

function buildQuickAddMessage(aiResult, count) {
    const engineName = aiResult.ai_engine === "gemini" ? "Gemini API" : "Rule-based fallback";
    
    if (count <= 0) {
        return aiResult.explanation || "AI chưa nhận diện được giao dịch hợp lệ.";
    }

    let message = "";

    if (count === 1) {
        message = aiResult.explanation || "AI đã thêm 1 giao dịch vào danh sách.";
    } else {
        message = `AI đã tách và thêm ${count} giao dịch từ câu nhập.`;
    }

    if (aiResult.gemini_error && aiResult.ai_engine !== "gemini") {
        message += " Gemini hiện bị giới hạn quota nên hệ thống đã dùng cơ chế dự phòng.";
    }

    message += ` Nguồn xử lý: ${engineName}.`;

    return message;
}

async function handleQuickAdd(event) {
    event.preventDefault();
    const input = document.getElementById("quickText");
    const result = document.getElementById("quickResult");

    if (!input || !result) return;

    const text = input.value.trim();

    if (!text) {
        alert("Vui lòng nhập nội dung giao dịch.");
        return;
    }

    result.textContent = "AI Backend đang phân tích câu giao dịch...";

    try {
        const aiResult = await parseTransactionByAI(text);
        const aiTransactions = normalizeAITransactions(aiResult, text);

        if (!aiResult.is_valid || aiTransactions.length === 0) {
            result.textContent = aiResult.explanation || "AI chưa nhận diện được giao dịch hợp lệ.";
            return;
        }

        const data = getTransactions();
        const now = Date.now();

        const newTransactions = aiTransactions.map((item, index) => ({
            id: now + index,
            date: getToday(),
            type: item.type,
            category: item.category,
            amount: Number(item.amount),
            note: item.note || text
        }));

        data.push(...newTransactions);

        saveTransactions(data);
        invalidateAIAnalysisCache();

        result.textContent = buildQuickAddMessage(aiResult, newTransactions.length);

        input.value = "";
        renderDashboard();

        setAIAnalysisText("Dữ liệu vừa được cập nhật bằng AI. Mở lại mục Tổng quan hoặc Trợ lý AI để hệ thống phân tích lại khi cần.");
    } catch (error) {
        result.textContent = `Không thể gọi AI Backend. ${error.message}`;
    }
}

function getFilteredReportTransactions() {
    const data = getTransactions();
    const period = document.getElementById("reportPeriod")?.value || "all";
    const month = document.getElementById("reportMonth")?.value || getCurrentMonth();
    const type = document.getElementById("reportType")?.value || "all";
    
    return data.filter(item => {
        const matchMonth = period === "all" ? true : String(item.date || "").startsWith(month);
        const matchType = type === "all" ? true : item.type === type;

        return matchMonth && matchType;
    });
}

function getReportRangeText() {
    const period = document.getElementById("reportPeriod")?.value || "all";
    const month = document.getElementById("reportMonth")?.value || getCurrentMonth();
    const type = document.getElementById("reportType")?.value || "all";
    let text = "Phạm vi báo cáo: ";

    if (period === "all") {
        text += "Tất cả dữ liệu";
    } else {
        text += `Tháng ${month}`;
    }

    if (type !== "all") {
        text += ` - ${type === "Thu" ? "Chỉ khoản thu" : "Chỉ khoản chi"}`;
    }

    return text;
}

function getTopExpenseCategory(data) {
    const grouped = groupExpenseByCategory(data);
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return null;

    return {
        category: entries[0][0],
        amount: entries[0][1]
    };
}

function buildReportSummary(data) {
    if (data.length === 0) {
        return "Không có giao dịch nào trong phạm vi báo cáo đã chọn. Bạn có thể đổi bộ lọc hoặc thêm giao dịch mới để hệ thống tạo báo cáo chi tiết hơn.";
    }
    const summary = calculateSummary(data);
    const topCategory = getTopExpenseCategory(data);

    let text = `Trong phạm vi báo cáo, tổng thu đạt ${formatMoney(summary.income)}, tổng chi là ${formatMoney(summary.expense)}, số dư còn lại là ${formatMoney(summary.balance)}. `;

    if (summary.income > 0) {
        text += `Tỷ lệ tiết kiệm đạt ${summary.savingRate.toFixed(1)}%. `;
    } else {
        text += "Chưa có dữ liệu thu nhập nên tỷ lệ tiết kiệm chưa được đánh giá đầy đủ. ";
    }

    if (topCategory) {
        text += `Danh mục chi tiêu lớn nhất là ${topCategory.category}, với tổng số tiền ${formatMoney(topCategory.amount)}. `;
    }

    if (summary.balance < 0) {
        text += "Số dư đang âm, người dùng cần kiểm soát chi tiêu và ưu tiên giảm các khoản chi không cần thiết.";
    } else if (summary.savingRate >= 20) {
        text += "Tình hình tài chính khá tích cực, tỷ lệ tiết kiệm đang ở mức tốt.";
    } else {
        text += "Người dùng nên đặt ngân sách theo danh mục và tăng tỷ lệ tiết kiệm trong các kỳ tiếp theo.";
    }

    return text;
}

function renderReportSummaryCards(data) {
    const summary = calculateSummary(data);
    const topCategory = getTopExpenseCategory(data);
    const reportIncome = document.getElementById("reportIncome");
    const reportExpense = document.getElementById("reportExpense");
    const reportBalance = document.getElementById("reportBalance");
    const reportSavingRate = document.getElementById("reportSavingRate");
    const reportTransactionCount = document.getElementById("reportTransactionCount");
    const reportTopCategory = document.getElementById("reportTopCategory");

    if (reportIncome) reportIncome.textContent = formatMoney(summary.income);
    if (reportExpense) reportExpense.textContent = formatMoney(summary.expense);
    if (reportBalance) reportBalance.textContent = formatMoney(summary.balance);
    if (reportSavingRate) reportSavingRate.textContent = summary.savingRate.toFixed(1) + "%";
    if (reportTransactionCount) reportTransactionCount.textContent = data.length;
    if (reportTopCategory) reportTopCategory.textContent = topCategory ? topCategory.category : "Không có";
}

function getReportCategoryRows(data) {
    const totalAmount = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const grouped = {};
    
    data.forEach(item => {
        const key = `${item.type}__${item.category}`;

        if (!grouped[key]) {
            grouped[key] = {
                type: item.type,
                category: item.category,
                count: 0,
                amount: 0
            };
        }

        grouped[key].count += 1;
        grouped[key].amount += Number(item.amount || 0);
    });

    return Object.values(grouped)
        .sort((a, b) => b.amount - a.amount)
        .map(row => ({
            ...row,
            percent: totalAmount > 0 ? row.amount / totalAmount * 100 : 0
        }));
}

function renderReportCategoryTable(data) {
    const tbody = document.getElementById("reportCategoryTableBody");
    if (!tbody) return;

    const rows = getReportCategoryRows(data);

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-slate-500 py-8">
                    Không có dữ liệu danh mục.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <span class="${row.type === "Thu" ? "badge-income" : "badge-expense"}">
                    ${escapeHTML(row.type)}
                </span>
            </td>
            <td>${escapeHTML(row.category)}</td>
            <td>${row.count}</td>
            <td class="font-bold">${formatMoney(row.amount)}</td>
            <td>${row.percent.toFixed(1)}%</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderReportMonthlyTable(data) {
    const tbody = document.getElementById("reportMonthlyTableBody");
    if (!tbody) return;

    const grouped = groupByMonth(data);
    const months = Object.keys(grouped).sort();

    if (months.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-slate-500 py-8">
                    Không có dữ liệu theo tháng.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    months.forEach(month => {
        const item = grouped[month];
        const balance = item.Thu - item.Chi;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHTML(month)}</td>
            <td class="font-bold text-green-600">${formatMoney(item.Thu)}</td>
            <td class="font-bold text-red-600">${formatMoney(item.Chi)}</td>
            <td class="font-bold text-blue-600">${formatMoney(balance)}</td>
            <td>${item.count}</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderReportCharts(data) {
    const categoryCanvas = document.getElementById("reportCategoryChart");
    const trendCanvas = document.getElementById("reportTrendChart");
    if (!categoryCanvas || !trendCanvas || typeof Chart === "undefined") return;

    const categoryData = groupExpenseByCategory(data);
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);

    if (reportCategoryChart) {
        reportCategoryChart.destroy();
    }

    reportCategoryChart = new Chart(categoryCanvas, {
        type: "doughnut",
        data: {
            labels: categoryLabels.length ? categoryLabels : ["Chưa có dữ liệu"],
            datasets: [{
                data: categoryValues.length ? categoryValues : [1],
                backgroundColor: [
                    "#2563eb",
                    "#06b6d4",
                    "#22c55e",
                    "#f97316",
                    "#ef4444",
                    "#a855f7",
                    "#14b8a6",
                    "#eab308",
                    "#64748b"
                ],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });

    const byMonth = groupByMonth(data);
    const labels = Object.keys(byMonth).sort();
    const incomeValues = labels.map(month => byMonth[month].Thu);
    const expenseValues = labels.map(month => byMonth[month].Chi);

    if (reportTrendChart) {
        reportTrendChart.destroy();
    }

    reportTrendChart = new Chart(trendCanvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Thu",
                    data: incomeValues,
                    backgroundColor: "#22c55e"
                },
                {
                    label: "Chi",
                    data: expenseValues,
                    backgroundColor: "#ef4444"
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderReport() {
    const data = getFilteredReportTransactions();
    const reportRangeText = document.getElementById("reportRangeText");
    const reportGeneratedAt = document.getElementById("reportGeneratedAt");
    const reportSummaryText = document.getElementById("reportSummaryText");

    if (reportRangeText) reportRangeText.textContent = getReportRangeText();

    if (reportGeneratedAt) {
        reportGeneratedAt.textContent = "Thời gian tạo báo cáo: " + new Date().toLocaleString("vi-VN");
    }

    if (reportSummaryText) {
        reportSummaryText.textContent = buildReportSummary(data);
    }

    renderReportSummaryCards(data);
    renderReportCategoryTable(data);
    renderReportMonthlyTable(data);
    renderReportCharts(data);
}

function convertTransactionsToCSV(data) {
    const header = [
        "Ngay",
        "Loai",
        "Danh muc",
        "So tien",
        "Ghi chu"
    ];
    
    const rows = data.map(item => [
        item.date || "",
        item.type || "",
        item.category || "",
        Number(item.amount || 0),
        item.note || ""
    ]);

    const csvRows = [header, ...rows].map(row => {
        return row.map(value => {
            const text = String(value).replaceAll('"', '""');
            return `"${text}"`;
        }).join(",");
    });

    return "\uFEFF" + csvRows.join("\n");
}

function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportReportCSV() {
    const data = getFilteredReportTransactions();
    if (data.length === 0) {
        alert("Không có dữ liệu để xuất CSV.");
        return;
    }

    const csv = convertTransactionsToCSV(data);
    const filename = `bao_cao_tai_chinh_${new Date().toISOString().slice(0, 10)}.csv`;

    downloadFile(filename, csv, "text/csv;charset=utf-8");
}

function printReport() {
    renderReport();
    setTimeout(() => {
        window.print();
    }, 300);
}

function initReportModule() {
    const reportPeriod = document.getElementById("reportPeriod");
    const reportMonth = document.getElementById("reportMonth");
    const reportType = document.getElementById("reportType");
    const generateReportBtn = document.getElementById("generateReportBtn");
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const printReportBtn = document.getElementById("printReportBtn");
    
    if (reportMonth) {
        reportMonth.value = getCurrentMonth();
    }

    if (reportPeriod) {
        reportPeriod.addEventListener("change", renderReport);
    }

    if (reportMonth) {
        reportMonth.addEventListener("change", renderReport);
    }

    if (reportType) {
        reportType.addEventListener("change", renderReport);
    }

    if (generateReportBtn) {
        generateReportBtn.addEventListener("click", renderReport);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportReportCSV);
    }

    if (printReportBtn) {
        printReportBtn.addEventListener("click", printReport);
    }
}

function renderDashboard() {
    const data = getTransactions();
    renderSummary(data);
    renderTransactionTable(data);
    renderCharts(data);

    const reportSection = document.getElementById("report-section");

    if (reportSection && !reportSection.classList.contains("hidden")) {
        renderReport();
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    const page = document.body.dataset.page;
    
    if (page === "register") {
        const form = document.getElementById("registerForm");
        if (form) form.addEventListener("submit", handleRegister);
    }

    if (page === "login") {
        const form = document.getElementById("loginForm");
        if (form) form.addEventListener("submit", handleLogin);
    }

    if (page === "dashboard") {
        const user = await loadCurrentUser();

        if (!user) {
            return;
        }

        initDashboardNavigation();

        seedDemoData();

        const dateInput = document.getElementById("transactionDate");
        if (dateInput) dateInput.value = getToday();

        updateCategoryOptions();

        const typeSelect = document.getElementById("transactionType");
        if (typeSelect) typeSelect.addEventListener("change", updateCategoryOptions);

        const transactionForm = document.getElementById("transactionForm");
        if (transactionForm) transactionForm.addEventListener("submit", handleAddTransaction);

        const walletForm = document.getElementById("walletForm");
        if (walletForm) walletForm.addEventListener("submit", handleWalletForm);

        const aiForm = document.getElementById("aiForm");
        if (aiForm) aiForm.addEventListener("submit", handleAIQuestion);

        const quickAddForm = document.getElementById("quickAddForm");
        if (quickAddForm) quickAddForm.addEventListener("submit", handleQuickAdd);

        initReportModule();

        await loadWallets();
        renderDashboard();
        showDashboardSection("overview-section");
    }
});