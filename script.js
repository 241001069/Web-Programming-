const STORAGE_KEY = "wealthwise_transactions_v1";
const BUDGET_KEY = "wealthwise_monthly_budget_v1";
const GOALS_KEY = "wealthwise_savings_goals_v1";

const $ = (id) => document.getElementById(id);

const balanceValue = $("balanceValue");
const incomeValue = $("incomeValue");
const expenseValue = $("expenseValue");
const transactionList = $("transactionList");
const emptyState = $("emptyState");
const transactionModal = $("transactionModal");
const transactionForm = $("transactionForm");
const filterType = $("filterType");
const budgetInput = $("budgetInput");

let transactions = loadTransactions();
let monthlyBudget = loadBudget();
let savingsGoals = loadSavingsGoals();
let toastTimeout;

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];

    return saved.filter((item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      ["income", "expense"].includes(item.type) &&
      typeof item.category === "string" &&
      typeof item.date === "string"
    );
  } catch {
    return [];
  }
}

function loadBudget() {
  try {
    const value = Number(localStorage.getItem(BUDGET_KEY));
    return Number.isFinite(value) && value > 0 ? value : 10000;
  } catch {
    return 10000;
  }
}

/* NEW: Load saved savings goals */
function loadSavingsGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_KEY) || "[]");

    if (!Array.isArray(saved)) return [];

    return saved.filter((goal) =>
      goal &&
      typeof goal.id === "string" &&
      typeof goal.name === "string" &&
      Number.isFinite(goal.target) &&
      goal.target > 0 &&
      Number.isFinite(goal.saved) &&
      goal.saved >= 0 &&
      typeof goal.date === "string"
    );
  } catch {
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
    return true;
  } catch {
    showToast("Unable to save. Check your browser storage.");
    return false;
  }
}

/* NEW: Save savings goals separately */
function saveSavingsGoals() {
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(savingsGoals));
    return true;
  } catch {
    showToast("Unable to save goals. Check browser storage.");
    return false;
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString + "T12:00:00");

  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
}

function currentMonthKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthKey(dateString) {
  return dateString.slice(0, 7);
}

function getTotals(items = transactions) {
  return items.reduce((totals, item) => {
    if (item.type === "income") totals.income += item.amount;
    else totals.expense += item.amount;

    return totals;
  }, { income: 0, expense: 0 });
}

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function renderDashboard() {
  const totals = getTotals();

  balanceValue.textContent = formatMoney(totals.income - totals.expense);
  incomeValue.textContent = formatMoney(totals.income);
  expenseValue.textContent = formatMoney(totals.expense);

  renderTransactions();
  renderBudget();
  renderChart();

  /* NEW: Render savings goals */
  renderSavingsGoals();
}

function renderTransactions() {
  const selectedType = filterType.value;

  const filtered = [...transactions]
    .filter((item) => selectedType === "all" || item.type === selectedType)
    .sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date);
      return dateOrder || b.id.localeCompare(a.id);
    });

  transactionList.replaceChildren();
  emptyState.classList.toggle("show", filtered.length === 0);

  filtered.forEach((item) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "transaction-name";

    const icon = document.createElement("span");
    icon.className = `transaction-icon ${item.type === "expense" ? "expense" : ""}`;
    icon.textContent = categoryIcon(item.category);

    const nameDetails = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = item.title;

    const categorySmall = document.createElement("small");
    categorySmall.textContent = item.category;

    nameDetails.append(title, categorySmall);
    nameWrap.append(icon, nameDetails);
    nameCell.append(nameWrap);

    const categoryCell = document.createElement("td");
    const categoryPill = document.createElement("span");

    categoryPill.className = "category-pill";
    categoryPill.textContent = item.category;

    categoryCell.append(categoryPill);

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(item.date);

    const typeCell = document.createElement("td");
    const typePill = document.createElement("span");

    typePill.className = `type-pill ${item.type}`;
    typePill.textContent = item.type === "income" ? "Income" : "Expense";

    typeCell.append(typePill);

    const amountCell = document.createElement("td");

    amountCell.className =
      `amount-cell ${item.type === "income" ? "amount-positive" : "amount-negative"}`;

    amountCell.textContent =
      `${item.type === "income" ? "+" : "−"}${formatMoney(item.amount)}`;

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.className = "delete-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${item.title}`);
    deleteButton.title = "Delete transaction";

    deleteButton.addEventListener("click", () => {
      deleteTransaction(item.id);
    });

    actionCell.append(deleteButton);

    row.append(
      nameCell,
      categoryCell,
      dateCell,
      typeCell,
      amountCell,
      actionCell
    );

    transactionList.append(row);
  });
}

function categoryIcon(category) {
  const icons = {
    Salary: "₹",
    Allowance: "◈",
    Freelance: "↗",
    Food: "♨",
    Transport: "↗",
    Shopping: "◇",
    Education: "▤",
    Bills: "≡",
    Health: "+",
    Entertainment: "♫",
    Other: "₹"
  };

  return icons[category] || "₹";
}

function renderBudget() {
  const thisMonth = currentMonthKey();

  const spent = transactions
    .filter((item) =>
      item.type === "expense" &&
      getMonthKey(item.date) === thisMonth
    )
    .reduce((sum, item) => sum + item.amount, 0);

  const percent = (spent / monthlyBudget) * 100;
  const safePercent = Math.min(percent, 100);

  $("budgetSpent").textContent = formatMoney(spent);
  $("budgetLimitLabel").textContent = formatMoney(monthlyBudget);

  $("budgetProgress").style.width = `${safePercent}%`;

  $("budgetProgress").classList.toggle(
    "over-budget",
    percent > 100
  );

  $("budgetPercent").textContent = `${Math.round(percent)}% used`;

  const remaining = monthlyBudget - spent;

  $("budgetRemaining").textContent = remaining >= 0
    ? `${formatMoney(remaining)} left`
    : `${formatMoney(Math.abs(remaining))} over budget`;
}

function renderChart() {
  const chart = $("cashFlowChart");

  chart.replaceChildren();

  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", {
        month: "short"
      })
    });
  }

  const data = months.map((month) => {
    const monthTransactions = transactions.filter(
      (item) => getMonthKey(item.date) === month.key
    );

    const totals = getTotals(monthTransactions);

    return { ...month, ...totals };
  });

  const maxValue = Math.max(
    ...data.flatMap((month) => [
      month.income,
      month.expense
    ]),
    1
  );

  if (!transactions.length) {
    const empty = document.createElement("div");

    empty.className = "chart-empty";
    empty.textContent = "Add transactions to see your cash flow.";

    chart.append(empty);
    return;
  }

  data.forEach((month) => {
    const column = document.createElement("div");
    column.className = "chart-column";

    const pair = document.createElement("div");
    pair.className = "bar-pair";

    const incomeBar = document.createElement("div");

    incomeBar.className = "bar bar-income";

    incomeBar.style.height =
      `${Math.max((month.income / maxValue) * 100, month.income ? 4 : 0)}%`;

    incomeBar.title =
      `${month.label} income: ${formatMoney(month.income)}`;

    incomeBar.setAttribute(
      "aria-label",
      `Income ${formatMoney(month.income)}`
    );

    const expenseBar = document.createElement("div");

    expenseBar.className = "bar bar-expense";

    expenseBar.style.height =
      `${Math.max((month.expense / maxValue) * 100, month.expense ? 4 : 0)}%`;

    expenseBar.title =
      `${month.label} expenses: ${formatMoney(month.expense)}`;

    expenseBar.setAttribute(
      "aria-label",
      `Expenses ${formatMoney(month.expense)}`
    );

    pair.append(incomeBar, expenseBar);

    const label = document.createElement("span");

    label.className = "chart-month";
    label.textContent = month.label;

    column.append(pair, label);
    chart.append(column);
  });
}

function openModal() {
  $("formError").textContent = "";

  $("transactionDate").value =
    new Date().toLocaleDateString("en-CA");

  transactionModal.classList.add("open");
  transactionModal.setAttribute("aria-hidden", "false");

  $("transactionTitle").focus();
}

function closeModal() {
  transactionModal.classList.remove("open");
  transactionModal.setAttribute("aria-hidden", "true");
}

function deleteTransaction(id) {
  const item = transactions.find(
    (transaction) => transaction.id === id
  );

  if (!item) return;

  if (!window.confirm(`Delete "${item.title}"?`)) return;

  const previousTransactions = transactions;

  transactions = transactions.filter(
    (transaction) => transaction.id !== id
  );

  if (saveData()) {
    renderDashboard();
    showToast("Transaction deleted.");
  } else {
    transactions = previousTransactions;
  }
}

$("openFormBtn").addEventListener("click", openModal);
$("emptyAddBtn").addEventListener("click", openModal);
$("closeModalBtn").addEventListener("click", closeModal);

transactionModal.addEventListener("click", (event) => {
  if (event.target === transactionModal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    transactionModal.classList.contains("open")
  ) {
    closeModal();
  }
});

filterType.addEventListener("change", renderTransactions);

transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = $("transactionTitle").value.trim();
  const amount = Number($("transactionAmount").value);

  const type = document.querySelector(
    'input[name="type"]:checked'
  )?.value;

  const category = $("transactionCategory").value;
  const date = $("transactionDate").value;
  const error = $("formError");

  error.textContent = "";

  if (
    !title ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !date ||
    !["income", "expense"].includes(type)
  ) {
    error.textContent =
      "Enter a valid name, amount, type and date.";
    return;
  }

  const transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    amount,
    type,
    category,
    date
  };

  transactions.push(transaction);

  if (!saveData()) {
    transactions.pop();
    return;
  }

  transactionForm.reset();

  $("transactionDate").value =
    new Date().toLocaleDateString("en-CA");

  closeModal();
  renderDashboard();

  showToast("Transaction saved successfully.");
});

$("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const value = Number(budgetInput.value);

  if (!Number.isFinite(value) || value <= 0) {
    showToast("Enter a valid budget greater than zero.");
    return;
  }

  const previousBudget = monthlyBudget;

  monthlyBudget = value;

  if (!saveData()) {
    monthlyBudget = previousBudget;
    return;
  }

  renderBudget();

  showToast("Monthly budget updated.");
});

/* ==================================================
   NEW FEATURE: SAVINGS GOAL TRACKER
   ================================================== */

function openGoalForm() {
  $("goalError").textContent = "";
  $("goalFormContainer").hidden = false;

  $("goalName").focus();
}

function closeGoalForm() {
  $("goalFormContainer").hidden = true;
  $("goalForm").reset();
  $("goalError").textContent = "";

  $("goalSaved").value = "0";
}

$("openGoalBtn").addEventListener("click", openGoalForm);

$("cancelGoalBtn").addEventListener("click", closeGoalForm);

/* Create a new savings goal */
$("goalForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("goalName").value.trim();
  const target = Number($("goalTarget").value);
  const saved = Number($("goalSaved").value);
  const date = $("goalDate").value;

  const error = $("goalError");

  error.textContent = "";

  if (!name) {
    error.textContent = "Please enter a goal name.";
    return;
  }

  if (!Number.isFinite(target) || target <= 0) {
    error.textContent =
      "Target amount must be greater than zero.";
    return;
  }

  if (
    !Number.isFinite(saved) ||
    saved < 0 ||
    saved > target
  ) {
    error.textContent =
      "Saved amount must be between zero and the target amount.";
    return;
  }

  const goal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    target,
    saved,
    date
  };

  savingsGoals.push(goal);

  if (!saveSavingsGoals()) {
    savingsGoals.pop();
    return;
  }

  closeGoalForm();
  renderSavingsGoals();

  if (saved >= target) {
    showToast("🎉 Congratulations! Your goal is achieved!");
  } else {
    showToast("Savings goal created successfully!");
  }
});

/* Display savings goals */
function renderSavingsGoals() {
  const goalsList = $("goalsList");

  goalsList.replaceChildren();

  if (savingsGoals.length === 0) {
    const empty = document.createElement("div");

    empty.className = "goals-empty";

    const icon = document.createElement("div");
    icon.className = "goal-empty-icon";
    icon.textContent = "◎";

    const heading = document.createElement("h3");
    heading.textContent = "Start saving for something special";

    const description = document.createElement("p");
    description.textContent =
      "Create your first savings goal and track your progress here.";

    empty.append(icon, heading, description);
    goalsList.append(empty);

    return;
  }

  savingsGoals.forEach((goal) => {
    const card = document.createElement("article");

    card.className = "goal-card";

    const completed = goal.saved >= goal.target;

    const percentage = Math.min(
      Math.round((goal.saved / goal.target) * 100),
      100
    );

    const remaining = Math.max(
      goal.target - goal.saved,
      0
    );

    /* Goal heading */
    const headingRow = document.createElement("div");
    headingRow.className = "goal-card-heading";

    const icon = document.createElement("div");
    icon.className = "goal-card-icon";
    icon.textContent = "₹";

    const headingDetails = document.createElement("div");
    headingDetails.className = "goal-heading-details";

    const heading = document.createElement("h3");
    heading.textContent = goal.name;

    const targetLabel = document.createElement("p");
    targetLabel.textContent =
      `Target: ${formatMoney(goal.target)}`;

    headingDetails.append(heading, targetLabel);
    headingRow.append(icon, headingDetails);

    /* Completion badge */
    const badge = document.createElement("span");
    badge.className = "goal-badge";

    if (completed) {
      badge.textContent = "✓ Achieved";
      badge.classList.add("goal-completed");
    } else {
      badge.textContent = `${percentage}%`;
    }

    headingRow.append(badge);

    /* Saved amount */
    const amountRow = document.createElement("div");
    amountRow.className = "goal-amount-row";

    const savedLabel = document.createElement("span");
    savedLabel.textContent = "Already saved";

    const savedAmount = document.createElement("strong");
    savedAmount.textContent = formatMoney(goal.saved);

    amountRow.append(savedLabel, savedAmount);

    /* Progress bar */
    const progressTrack = document.createElement("div");
    progressTrack.className = "goal-progress-track";

    const progressFill = document.createElement("div");
    progressFill.className = "goal-progress-fill";
    progressFill.style.width = `${percentage}%`;

    if (completed) {
      progressFill.classList.add("goal-progress-complete");
    }

    progressTrack.append(progressFill);

    /* Remaining amount */
    const progressInfo = document.createElement("div");
    progressInfo.className = "goal-progress-info";

    const percentageLabel = document.createElement("span");
    percentageLabel.textContent = `${percentage}% completed`;

    const remainingLabel = document.createElement("span");

    remainingLabel.textContent = completed
      ? "Goal achieved!"
      : `${formatMoney(remaining)} remaining`;

    progressInfo.append(percentageLabel, remainingLabel);

    /* Optional target date */
    const dateLabel = document.createElement("p");
    dateLabel.className = "goal-date";

    if (goal.date) {
      dateLabel.textContent =
        `Target date: ${formatDate(goal.date)}`;
    } else {
      dateLabel.textContent = "Keep saving towards your goal.";
    }

    /* Actions */
    const actions = document.createElement("div");
    actions.className = "goal-actions";

    if (!completed) {
      const addSavingsButton = document.createElement("button");

      addSavingsButton.className = "secondary-btn";
      addSavingsButton.type = "button";
      addSavingsButton.textContent = "＋ Add savings";

      addSavingsButton.addEventListener("click", () => {
        addSavingsToGoal(goal.id);
      });

      actions.append(addSavingsButton);
    } else {
      const achievedMessage = document.createElement("span");

      achievedMessage.className = "goal-achieved-message";
      achievedMessage.textContent = "🎉 Congratulations!";

      actions.append(achievedMessage);
    }

    const deleteButton = document.createElement("button");

    deleteButton.className = "delete-btn goal-delete-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete savings goal";
    deleteButton.setAttribute(
      "aria-label",
      `Delete savings goal ${goal.name}`
    );

    deleteButton.addEventListener("click", () => {
      deleteSavingsGoal(goal.id);
    });

    actions.append(deleteButton);

    card.append(
      headingRow,
      amountRow,
      progressTrack,
      progressInfo,
      dateLabel,
      actions
    );

    goalsList.append(card);
  });
}

/* Add savings towards a goal */
function addSavingsToGoal(goalId) {
  const goal = savingsGoals.find(
    (item) => item.id === goalId
  );

  if (!goal) return;

  const remaining = goal.target - goal.saved;

  if (remaining <= 0) {
    showToast("This savings goal is already achieved!");
    return;
  }

  const input = window.prompt(
    `Goal: ${goal.name}\n` +
    `Already saved: ${formatMoney(goal.saved)}\n` +
    `Remaining: ${formatMoney(remaining)}\n\n` +
    "Enter the additional amount saved (₹):"
  );

  if (input === null) return;

  const amount = Number(input);

  if (
    input.trim() === "" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    showToast("Enter a valid savings amount.");
    return;
  }

  if (amount > remaining) {
    showToast(
      `You need only ${formatMoney(remaining)} to reach this goal.`
    );
    return;
  }

  const previousSaved = goal.saved;

  goal.saved += amount;

  if (!saveSavingsGoals()) {
    goal.saved = previousSaved;
    return;
  }

  renderSavingsGoals();

  if (goal.saved >= goal.target) {
    showToast("🎉 Congratulations! Savings goal achieved!");
  } else {
    showToast("Savings updated successfully!");
  }
}

/* Delete a savings goal */
function deleteSavingsGoal(goalId) {
  const goal = savingsGoals.find(
    (item) => item.id === goalId
  );

  if (!goal) return;

  if (
    !window.confirm(
      `Are you sure you want to delete "${goal.name}"?`
    )
  ) {
    return;
  }

  const previousGoals = savingsGoals;

  savingsGoals = savingsGoals.filter(
    (item) => item.id !== goalId
  );

  if (!saveSavingsGoals()) {
    savingsGoals = previousGoals;
    return;
  }

  renderSavingsGoals();

  showToast("Savings goal deleted.");
}

/* ==================================================
   END OF SAVINGS GOAL TRACKER
   ================================================== */

budgetInput.value = String(monthlyBudget);

$("transactionDate").value =
  new Date().toLocaleDateString("en-CA");

renderDashboard();