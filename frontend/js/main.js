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
    "Ä‚n uá»‘ng",
    "Di chuyá»ƒn",
    "NhÃ  á»Ÿ",
    "Há»c táº­p",
    "Giáº£i trÃ­",
    "Mua sáº¯m",
    "Y táº¿",
    "Gia Ä‘Ã¬nh",
    "KhÃ¡c"
];

const incomeCategories = [
    "LÆ°Æ¡ng",
    "ThÆ°á»Ÿng",
    "LÃ m thÃªm",
    "ÄÆ°á»£c cho",
    "KhÃ¡c"
];

const sectionInfo = {
    "overview-section": {
        title: "Tá»•ng quan tÃ i chÃ­nh",
        subtitle: "Theo dÃµi nhanh tÃ¬nh hÃ¬nh thu chi, sá»‘ dÆ° vÃ  tá»· lá»‡ tiáº¿t kiá»‡m"
    },
    "wallet-section": {
        title: "Quáº£n lÃ½ vÃ­ tiá»n",
        subtitle: "Táº¡o, xem vÃ  xÃ³a vÃ­ tiá»n tá»« cÆ¡ sá»Ÿ dá»¯ liá»‡u SQLite thÃ´ng qua Backend API"
    },
    "transaction-section": {
        title: "Quáº£n lÃ½ giao dá»‹ch",
        subtitle: "Ghi nháº­n cÃ¡c khoáº£n thu chi vÃ  theo dÃµi lá»‹ch sá»­ giao dá»‹ch"
    },
    "chart-section": {
        title: "Biá»ƒu Ä‘á»“ tÃ i chÃ­nh",
        subtitle: "Trá»±c quan hÃ³a chi tiÃªu theo danh má»¥c vÃ  biáº¿n Ä‘á»™ng thu chi theo ngÃ y"
    },
    "assistant-section": {
        title: "Trá»£ lÃ½ AI tÃ i chÃ­nh",
        subtitle: "PhÃ¢n tÃ­ch tÃ i chÃ­nh cÃ¡ nhÃ¢n vÃ  xá»­ lÃ½ giao dá»‹ch báº±ng ngÃ´n ngá»¯ tá»± nhiÃªn"
    },
    "report-section": {
        title: "BÃ¡o cÃ¡o tÃ i chÃ­nh",
        subtitle: "Tá»•ng há»£p dá»¯ liá»‡u thu chi, biá»ƒu Ä‘á»“, thá»‘ng kÃª vÃ  xuáº¥t bÃ¡o cÃ¡o"
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
        const errorMessage = data.detail || data.message || `Lá»—i API ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }

    return data;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " VNÄ";
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
            category: "LÆ°Æ¡ng",
            amount: 6500000,
            note: "LÆ°Æ¡ng thÃ¡ng"
        },
        {
            id: Date.now() + 2,
            date: getToday(),
            type: "Chi",
            category: "Ä‚n uá»‘ng",
            amount: 120000,
            note: "Ä‚n trÆ°a vÃ  cÃ  phÃª"
        },
        {
            id: Date.now() + 3,
            date: getToday(),
            type: "Chi",
            category: "Di chuyá»ƒn",
            amount: 70000,
            note: "XÄƒng xe"
        },
        {
            id: Date.now() + 4,
            date: getToday(),
            type: "Chi",
            category: "Giáº£i trÃ­",
            amount: 250000,
            note: "Xem phim cuá»‘i tuáº§n"
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
        alert("Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin.");
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

        alert("ÄÄƒng kÃ½ tÃ i khoáº£n thÃ nh cÃ´ng. Chuyá»ƒn sang trang Ä‘Äƒng nháº­p.");
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
        alert("Vui lÃ²ng nháº­p email vÃ  máº­t kháº©u.");
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
        // Bá» qua lá»—i khi logout
    }
    clearAuth();
    window.location.href = "./login.html";
}

async function loadCurrentUser() {
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    
    if (!getToken()) {
        alert("Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ truy cáº­p Dashboard.");
        window.location.href = "./login.html";
        return null;
    }

    try {
        const result = await apiRequest("/api/auth/me", {
            method: "GET"
        });

        const user = result.user;
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        if (userName) userName.textContent = user.full_name || "NgÆ°á»i dÃ¹ng";
        if (userEmail) userEmail.textContent = user.email || "";

        return user;
    } catch (error) {
        alert("PhiÃªn Ä‘Äƒng nháº­p khÃ´ng há»£p lá»‡. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
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
        alert("Vui lÃ²ng nháº­p Ä‘áº§y Ä‘á»§ thÃ´ng tin vÃ  sá»‘ tiá»n pháº£i lá»›n hÆ¡n 0.");
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

    setAIAnalysisText("Dá»¯ liá»‡u giao dá»‹ch vá»«a thay Ä‘á»•i. Má»Ÿ má»¥c Tá»•ng quan hoáº·c Trá»£ lÃ½ AI Ä‘á»ƒ há»‡ thá»‘ng phÃ¢n tÃ­ch láº¡i khi cáº§n.");
}

function deleteTransaction(id) {
    const data = getTransactions().filter(item => item.id !== id);
    saveTransactions(data);
    invalidateAIAnalysisCache();
    renderDashboard();
    setAIAnalysisText("Dá»¯ liá»‡u giao dá»‹ch vá»«a thay Ä‘á»•i. Má»Ÿ má»¥c Tá»•ng quan hoáº·c Trá»£ lÃ½ AI Ä‘á»ƒ há»‡ thá»‘ng phÃ¢n tÃ­ch láº¡i khi cáº§n.");
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
                    ChÆ°a cÃ³ giao dá»‹ch nÃ o.
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
            <td>${escapeHTML(item.note || "KhÃ´ng cÃ³ ghi chÃº")}</td>
            <td>
                <button class="btn-danger" onclick="deleteTransaction(${item.id})">
                    XÃ³a
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
        const month = String(item.date || "").slice(0, 7) || "KhÃ´ng rÃµ";

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
            labels: categoryLabels.length ? categoryLabels : ["ChÆ°a cÃ³ dá»¯ liá»‡u"],
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
            walletStatus.textContent = "ÄÃ£ táº£i dá»¯ liá»‡u vÃ­ tá»« Backend API thÃ nh cÃ´ng.";
        }

        if (wallets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-slate-500 py-8">
                        ChÆ°a cÃ³ vÃ­ nÃ o.
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
                        XÃ³a
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-red-500 py-8">
                    KhÃ´ng thá»ƒ táº£i danh sÃ¡ch vÃ­. ${escapeHTML(error.message)}
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
        alert("TÃªn vÃ­ khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
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

        alert("Táº¡o vÃ­ thÃ nh cÃ´ng.");
        event.target.reset();
        await loadWallets();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteWallet(walletId) {
    const confirmDelete = confirm("Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a vÃ­ nÃ y khÃ´ng?");
    if (!confirmDelete) return;

    try {
        await apiRequest(`/api/wallets/${walletId}`, {
            method: "DELETE"
        });

        alert("XÃ³a vÃ­ thÃ nh cÃ´ng.");
        await loadWallets();
    } catch (error) {
        alert(error.message);
    }
}

function generateAIAnalysisFallback(data) {
    if (data.length === 0) {
        return "ChÆ°a cÃ³ dá»¯ liá»‡u giao dá»‹ch. Báº¡n hÃ£y thÃªm má»™t vÃ i khoáº£n thu vÃ  chi Ä‘á»ƒ trá»£ lÃ½ AI cÃ³ thá»ƒ phÃ¢n tÃ­ch tÃ¬nh hÃ¬nh tÃ i chÃ­nh.";
    }
    const summary = calculateSummary(data);
    const expenseByCategory = groupExpenseByCategory(data);
    const sortedCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

    let message = `Trong dá»¯ liá»‡u hiá»‡n táº¡i, tá»•ng thu lÃ  ${formatMoney(summary.income)}, tá»•ng chi lÃ  ${formatMoney(summary.expense)}, sá»‘ dÆ° cÃ²n láº¡i lÃ  ${formatMoney(summary.balance)}. `;

    if (sortedCategories.length > 0) {
        const [topCategory, topAmount] = sortedCategories[0];
        message += `Danh má»¥c chi nhiá»u nháº¥t lÃ  ${topCategory}, vá»›i tá»•ng sá»‘ tiá»n ${formatMoney(topAmount)}. `;
    }

    message += "Gá»£i Ã½: nÃªn ghi chÃ©p giao dá»‹ch háº±ng ngÃ y, kiá»ƒm tra biá»ƒu Ä‘á»“ má»—i tuáº§n vÃ  Ä‘áº·t má»¥c tiÃªu tiáº¿t kiá»‡m tá»‘i thiá»ƒu 10-20% thu nháº­p.";

    return message;
}

function buildAIAnalysisText(aiResult) {
    let text = aiResult.analysis || "AI chÆ°a tráº£ vá» ná»™i dung phÃ¢n tÃ­ch.";
    if (Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0) {
        text += "\n\nGá»£i Ã½:";
        aiResult.suggestions.forEach(item => {
            text += `\n- ${item}`;
        });
    }

    if (aiResult.ai_engine) {
        const engineName = aiResult.ai_engine === "gemini" ? "Gemini API" : "Rule-based fallback";
        text += `\n\nNguá»“n xá»­ lÃ½: ${engineName}`;
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

    setAIAnalysisText("AI Backend Ä‘ang phÃ¢n tÃ­ch dá»¯ liá»‡u tÃ i chÃ­nh...");

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
        alert("Vui lÃ²ng nháº­p cÃ¢u há»i cho trá»£ lÃ½ AI.");
        return;
    }

    const data = getTransactions();

    chatBox.innerHTML += `
        <div class="user-message mb-3">
            <b>Báº¡n:</b> ${escapeHTML(question)}
        </div>
        <div class="ai-message mb-3">
            <b>AI:</b> Äang gá»­i cÃ¢u há»i tá»›i AI Backend...
        </div>
    `;

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const aiResult = await getAIChatAnswerFromBackend(question, data);
        const answer = aiResult.answer || "AI chÆ°a cÃ³ cÃ¢u tráº£ lá»i phÃ¹ há»£p.";
        const engineName = aiResult.ai_engine === "gemini" ? "Gemini API" : "Rule-based fallback";

        const aiMessages = chatBox.querySelectorAll(".ai-message");
        const lastAiMessage = aiMessages[aiMessages.length - 1];

        if (lastAiMessage) {
            lastAiMessage.innerHTML = `
                <b>AI:</b> ${escapeHTML(answer)}
                <div class="text-xs text-slate-500 mt-1">Nguá»“n xá»­ lÃ½: ${engineName}</div>
            `;
        }
    } catch (error) {
        const aiMessages = chatBox.querySelectorAll(".ai-message");
        const lastAiMessage = aiMessages[aiMessages.length - 1];

        if (lastAiMessage) {
            lastAiMessage.innerHTML = `<b>AI:</b> KhÃ´ng thá»ƒ káº¿t ná»‘i AI Backend. ${escapeHTML(error.message)}`;
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
                category: item.category || aiResult.category || "KhÃ¡c",
                amount: Number(item.amount || 0),
                note: item.note || originalText
            }));
    }
    
    if (aiResult.is_valid && Number(aiResult.amount || 0) > 0) {
        return [
            {
                type: aiResult.transaction_type || "Chi",
                category: aiResult.category || "KhÃ¡c",
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
        return aiResult.explanation || "AI chÆ°a nháº­n diá»‡n Ä‘Æ°á»£c giao dá»‹ch há»£p lá»‡.";
    }

    let message = "";

    if (count === 1) {
        message = aiResult.explanation || "AI Ä‘Ã£ thÃªm 1 giao dá»‹ch vÃ o danh sÃ¡ch.";
    } else {
        message = `AI Ä‘Ã£ tÃ¡ch vÃ  thÃªm ${count} giao dá»‹ch tá»« cÃ¢u nháº­p.`;
    }

    if (aiResult.gemini_error && aiResult.ai_engine !== "gemini") {
        message += " Gemini hiá»‡n bá»‹ giá»›i háº¡n quota nÃªn há»‡ thá»‘ng Ä‘Ã£ dÃ¹ng cÆ¡ cháº¿ dá»± phÃ²ng.";
    }

    message += ` Nguá»“n xá»­ lÃ½: ${engineName}.`;

    return message;
}

async function handleQuickAdd(event) {
    event.preventDefault();
    const input = document.getElementById("quickText");
    const result = document.getElementById("quickResult");

    if (!input || !result) return;

    const text = input.value.trim();

    if (!text) {
        alert("Vui lÃ²ng nháº­p ná»™i dung giao dá»‹ch.");
        return;
    }

    result.textContent = "AI Backend Ä‘ang phÃ¢n tÃ­ch cÃ¢u giao dá»‹ch...";

    try {
        const aiResult = await parseTransactionByAI(text);
        const aiTransactions = normalizeAITransactions(aiResult, text);

        if (!aiResult.is_valid || aiTransactions.length === 0) {
            result.textContent = aiResult.explanation || "AI chÆ°a nháº­n diá»‡n Ä‘Æ°á»£c giao dá»‹ch há»£p lá»‡.";
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

        setAIAnalysisText("Dá»¯ liá»‡u vá»«a Ä‘Æ°á»£c cáº­p nháº­t báº±ng AI. Má»Ÿ láº¡i má»¥c Tá»•ng quan hoáº·c Trá»£ lÃ½ AI Ä‘á»ƒ há»‡ thá»‘ng phÃ¢n tÃ­ch láº¡i khi cáº§n.");
    } catch (error) {
        result.textContent = `KhÃ´ng thá»ƒ gá»i AI Backend. ${error.message}`;
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
    let text = "Pháº¡m vi bÃ¡o cÃ¡o: ";

    if (period === "all") {
        text += "Táº¥t cáº£ dá»¯ liá»‡u";
    } else {
        text += `ThÃ¡ng ${month}`;
    }

    if (type !== "all") {
        text += ` - ${type === "Thu" ? "Chá»‰ khoáº£n thu" : "Chá»‰ khoáº£n chi"}`;
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
        return "KhÃ´ng cÃ³ giao dá»‹ch nÃ o trong pháº¡m vi bÃ¡o cÃ¡o Ä‘Ã£ chá»n. Báº¡n cÃ³ thá»ƒ Ä‘á»•i bá»™ lá»c hoáº·c thÃªm giao dá»‹ch má»›i Ä‘á»ƒ há»‡ thá»‘ng táº¡o bÃ¡o cÃ¡o chi tiáº¿t hÆ¡n.";
    }
    const summary = calculateSummary(data);
    const topCategory = getTopExpenseCategory(data);

    let text = `Trong pháº¡m vi bÃ¡o cÃ¡o, tá»•ng thu Ä‘áº¡t ${formatMoney(summary.income)}, tá»•ng chi lÃ  ${formatMoney(summary.expense)}, sá»‘ dÆ° cÃ²n láº¡i lÃ  ${formatMoney(summary.balance)}. `;

    if (summary.income > 0) {
        text += `Tá»· lá»‡ tiáº¿t kiá»‡m Ä‘áº¡t ${summary.savingRate.toFixed(1)}%. `;
    } else {
        text += "ChÆ°a cÃ³ dá»¯ liá»‡u thu nháº­p nÃªn tá»· lá»‡ tiáº¿t kiá»‡m chÆ°a Ä‘Æ°á»£c Ä‘Ã¡nh giÃ¡ Ä‘áº§y Ä‘á»§. ";
    }

    if (topCategory) {
        text += `Danh má»¥c chi tiÃªu lá»›n nháº¥t lÃ  ${topCategory.category}, vá»›i tá»•ng sá»‘ tiá»n ${formatMoney(topCategory.amount)}. `;
    }

    if (summary.balance < 0) {
        text += "Sá»‘ dÆ° Ä‘ang Ã¢m, ngÆ°á»i dÃ¹ng cáº§n kiá»ƒm soÃ¡t chi tiÃªu vÃ  Æ°u tiÃªn giáº£m cÃ¡c khoáº£n chi khÃ´ng cáº§n thiáº¿t.";
    } else if (summary.savingRate >= 20) {
        text += "TÃ¬nh hÃ¬nh tÃ i chÃ­nh khÃ¡ tÃ­ch cá»±c, tá»· lá»‡ tiáº¿t kiá»‡m Ä‘ang á»Ÿ má»©c tá»‘t.";
    } else {
        text += "NgÆ°á»i dÃ¹ng nÃªn Ä‘áº·t ngÃ¢n sÃ¡ch theo danh má»¥c vÃ  tÄƒng tá»· lá»‡ tiáº¿t kiá»‡m trong cÃ¡c ká»³ tiáº¿p theo.";
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
    if (reportTopCategory) reportTopCategory.textContent = topCategory ? topCategory.category : "KhÃ´ng cÃ³";
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
                    KhÃ´ng cÃ³ dá»¯ liá»‡u danh má»¥c.
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
                    KhÃ´ng cÃ³ dá»¯ liá»‡u theo thÃ¡ng.
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
            labels: categoryLabels.length ? categoryLabels : ["ChÆ°a cÃ³ dá»¯ liá»‡u"],
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
        reportGeneratedAt.textContent = "Thá»i gian táº¡o bÃ¡o cÃ¡o: " + new Date().toLocaleString("vi-VN");
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
        alert("KhÃ´ng cÃ³ dá»¯ liá»‡u Ä‘á»ƒ xuáº¥t CSV.");
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
