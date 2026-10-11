const USERS_KEY = "budgetPlannerUsers";
const SESSION_KEY = "budgetPlannerCurrentUser";
const THEME_KEY = "budgetPlannerTheme";
const DATA_KEY = "personalBudgetPlannerData_";

// Categories depend on the transaction type
const CATEGORIES = {
  expense: ["Food", "Travel", "Shopping", "Education", "Bills", "Health", "Other"],
  income: ["Salary", "Allowance", "Other"]
};

const $ = id => document.getElementById(id);
let registerMode = false;
let currentUser = localStorage.getItem(SESSION_KEY) || "";
// budgets are stored per month, e.g. { "2026-10": 5000 }
let data = { budgets: {}, transactions: [] };
let selectedMonth = currentMonthKey();

/* ---------- Helpers ---------- */
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function money(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Storage ---------- */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); }
  catch { return {}; }
}
function saveData() {
  if (currentUser) localStorage.setItem(DATA_KEY + currentUser, JSON.stringify(data));
}
function loadData() {
  const empty = { budgets: {}, transactions: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY + currentUser) || "null");
    if (!saved) return empty;
    const result = {
      budgets: saved.budgets && typeof saved.budgets === "object" ? saved.budgets : {},
      transactions: Array.isArray(saved.transactions) ? saved.transactions : []
    };
    // Older saves had a single budget number: keep it for the current month
    if (Number(saved.budget) && !Object.keys(result.budgets).length) {
      result.budgets[currentMonthKey()] = Number(saved.budget);
    }
    return result;
  } catch { return empty; }
}

/* ---------- Login / logout ---------- */
function setAuthMode(register) {
  registerMode = register;
  $("auth-title").textContent = register ? "Create your account" : "Sign in to your budget";
  $("auth-submit").textContent = register ? "Create account" : "Sign in";
  $("auth-switch-text").textContent = register ? "Already have an account?" : "New here?";
  $("auth-switch").textContent = register ? "Sign in" : "Create an account";
  $("auth-message").textContent = "";
}
function showApp() {
  $("auth-panel").classList.add("hidden"); $("app-content").classList.remove("hidden"); $("logout-button").classList.remove("hidden");
  data = loadData();
  selectedMonth = currentMonthKey();
  $("view-month").value = selectedMonth;
  fillCategories();
  setBudgetInput();
  render();
}
function showLogin() {
  currentUser = ""; localStorage.removeItem(SESSION_KEY);
  $("auth-panel").classList.remove("hidden"); $("app-content").classList.add("hidden"); $("logout-button").classList.add("hidden");
  $("auth-form").reset(); setAuthMode(false);
  $("form-message").textContent = ""; $("budget-message").textContent = "";
}
$("auth-switch").addEventListener("click", () => setAuthMode(!registerMode));
$("auth-form").addEventListener("submit", event => {
  event.preventDefault();
  const username = $("auth-username").value.trim().toLowerCase();
  const password = $("auth-password").value;
  const users = getUsers();
  const message = $("auth-message");
  if (!/^[a-z0-9_]{3,30}$/.test(username)) { message.style.color = "var(--red)"; message.textContent = "Use 3–30 letters, numbers, or underscores for username."; return; }
  if (password.length < 4) { message.style.color = "var(--red)"; message.textContent = "Password must be at least 4 characters for this demo."; return; }
  if (registerMode) {
    if (users[username]) { message.style.color = "var(--red)"; message.textContent = "Username already exists. Please sign in."; return; }
    // Classroom demonstration only: real apps must never store plain-text passwords.
    users[username] = { password: password };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } else if (!users[username] || users[username].password !== password) {
    message.style.color = "var(--red)"; message.textContent = "Username or password is incorrect."; return;
  }
  currentUser = username; localStorage.setItem(SESSION_KEY, currentUser); showApp();
});
$("logout-button").addEventListener("click", showLogin);

/* ---------- Theme ---------- */
function applyTheme(theme) {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);
  $("theme-toggle").textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}
$("theme-toggle").addEventListener("click", () => applyTheme(document.body.classList.contains("dark") ? "light" : "dark"));
applyTheme(localStorage.getItem(THEME_KEY) || "light");

/* ---------- Month-based data ---------- */
function getBudget() { return Number(data.budgets[selectedMonth]) || 0; }
function setBudgetInput() { $("monthly-budget").value = getBudget() || ""; }
// Only the transactions that belong to the selected month (date is "YYYY-MM-DD")
function monthTransactions() {
  return data.transactions.filter(t => t.date.slice(0, 7) === selectedMonth);
}
function totals() {
  let income = 0, expenses = 0;
  monthTransactions().forEach(t => { if (t.type === "income") income += t.amount; else expenses += t.amount; });
  income = round2(income); expenses = round2(expenses);
  return { income, expenses, balance: round2(getBudget() - expenses) };
}

/* ---------- Rendering ---------- */
function fillCategories() {
  const select = $("transaction-category");
  select.innerHTML = "";
  CATEGORIES[$("transaction-type").value].forEach(name => {
    const option = document.createElement("option");
    option.textContent = name;
    select.appendChild(option);
  });
}
function renderSummary() {
  const t = totals(), budget = getBudget();
  $("budget-total").textContent = money(budget); $("income-total").textContent = money(t.income);
  $("expense-total").textContent = money(t.expenses); $("balance-total").textContent = money(t.balance);
  $("balance-total").style.color = t.balance < 0 ? "var(--red)" : "var(--green)";

  const warning = $("budget-warning");
  if (budget > 0 && t.expenses > budget) {
    warning.textContent = `⚠ You are over budget by ${money(t.expenses - budget)}.`;
    warning.classList.remove("hidden");
  } else if (budget > 0 && t.expenses >= budget * 0.8) {
    warning.textContent = `⚠ You have used ${Math.round(t.expenses / budget * 100)}% of this month's budget.`;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }
}
function renderCategories() {
  const box = $("category-list"); box.innerHTML = "";
  const byCategory = {};
  monthTransactions().filter(t => t.type === "expense").forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, r) => sum + r[1], 0);
  rows.forEach(([name, amount]) => {
    const percent = total ? (amount / total) * 100 : 0;
    const row = document.createElement("div"); row.className = "category-row";
    const top = document.createElement("div"); top.className = "category-row-top";
    const label = document.createElement("span"); label.textContent = name;
    const value = document.createElement("span"); value.textContent = `${money(round2(amount))} (${percent.toFixed(0)}%)`;
    top.append(label, value);
    const track = document.createElement("div"); track.className = "bar-track";
    const fill = document.createElement("div"); fill.className = "bar-fill"; fill.style.width = percent + "%";
    track.appendChild(fill);
    row.append(top, track); box.appendChild(row);
  });
  $("category-empty").style.display = rows.length ? "none" : "block";
}
function renderTransactions() {
  const tbody = $("transaction-list"); tbody.innerHTML = "";
  const filter = $("filter-type").value;
  // newest date first; for the same date, the most recently added first
  const list = monthTransactions()
    .filter(t => filter === "all" || t.type === filter)
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));
  list.forEach(t => {
    const row = document.createElement("tr"), details = document.createElement("td");
    const title = document.createElement("span"); title.className = "transaction-name"; title.textContent = t.title;
    const category = document.createElement("span"); category.className = "category-pill"; category.textContent = t.category;
    details.append(title, document.createElement("br"), category);
    const date = document.createElement("td"); date.textContent = t.date;
    const amount = document.createElement("td"); amount.className = t.type === "income" ? "amount-income" : "amount-expense"; amount.textContent = (t.type === "income" ? "+ " : "− ") + money(t.amount);
    const action = document.createElement("td"), del = document.createElement("button"); del.className = "delete-button"; del.textContent = "Delete"; del.type = "button";
    del.addEventListener("click", () => { data.transactions = data.transactions.filter(item => item.id !== t.id); saveData(); render(); });
    action.appendChild(del); row.append(details, date, amount, action); tbody.appendChild(row);
  });
  $("empty-message").style.display = list.length ? "none" : "block";
}
function render() { renderSummary(); renderCategories(); renderTransactions(); }

/* ---------- Events ---------- */
$("view-month").addEventListener("change", () => {
  selectedMonth = $("view-month").value || currentMonthKey();
  $("view-month").value = selectedMonth;
  $("budget-message").textContent = "";
  setBudgetInput();
  render();
});
$("budget-form").addEventListener("submit", event => {
  event.preventDefault(); const amount = Number($("monthly-budget").value);
  if (!Number.isFinite(amount) || amount < 0) return alert("Enter a valid budget amount.");
  data.budgets[selectedMonth] = amount; saveData(); render();
  $("budget-message").textContent = `Budget saved for ${monthLabel(selectedMonth)}.`;
});
$("transaction-type").addEventListener("change", fillCategories);
$("transaction-date").value = today();
$("transaction-form").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("transaction-title").value.trim(), amount = Number($("transaction-amount").value), date = $("transaction-date").value;
  if (!title) { $("form-message").textContent = "Enter a description."; return; }
  if (!Number.isFinite(amount) || amount <= 0) { $("form-message").textContent = "Enter an amount greater than zero."; return; }
  if (!date) { $("form-message").textContent = "Choose a date."; return; }
  data.transactions.push({ id: Date.now().toString() + Math.random().toString(16).slice(2), type: $("transaction-type").value, title, amount, category: $("transaction-category").value, date });
  saveData(); render();
  $("transaction-form").reset(); fillCategories(); $("transaction-date").value = today();
  $("form-message").textContent = date.slice(0, 7) === selectedMonth
    ? "Transaction saved successfully."
    : `Saved under ${monthLabel(date.slice(0, 7))}. Change the viewing month to see it.`;
});
$("filter-type").addEventListener("change", renderTransactions);
$("clear-all").addEventListener("click", () => {
  if (!data.transactions.length) return alert("There are no transactions to clear.");
  if (confirm("Delete ALL transactions (every month) for this account? This cannot be undone.")) { data.transactions = []; saveData(); render(); $("form-message").textContent = "All transactions cleared."; }
});

/* ---------- Start ---------- */
fillCategories();
setAuthMode(false);
if (currentUser && getUsers()[currentUser]) showApp(); else showLogin();
