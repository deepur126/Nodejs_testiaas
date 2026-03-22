const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const sessions = new Map();

ensureDatabase();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method || 'GET';
    const cookies = parseCookies(req.headers.cookie || '');
    const session = cookies.sid ? sessions.get(cookies.sid) : null;
    const user = session ? getUserById(session.userId) : null;

    if (url.pathname.startsWith('/public/')) {
      return serveStatic(req, res, url.pathname.replace('/public/', ''));
    }

    if (method === 'GET' && url.pathname === '/') {
      return sendPage(res, renderLayout(renderHomePage(url.searchParams.get('error')), user));
    }

    if (method === 'POST' && url.pathname === '/register') {
      const form = await parseForm(req);
      const validationError = validateRegistration(form);
      if (validationError) {
        return redirect(res, `/?error=${encodeURIComponent(validationError)}`);
      }

      const db = readDb();
      const normalizedEmail = form.email.trim().toLowerCase();
      if (db.users.some((item) => item.email === normalizedEmail)) {
        return redirect(res, '/?error=Account already exists for that email.');
      }

      const userId = crypto.randomUUID();
      const userRecord = {
        id: userId,
        name: form.name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(form.password),
        profile: {
          monthlyIncomeTarget: Number(form.monthlyIncomeTarget || 0),
          monthlyBudgetTarget: Number(form.monthlyBudgetTarget || 0),
          notes: form.notes?.trim() || ''
        }
      };
      db.users.push(userRecord);
      writeDb(db);
      return createSession(res, userId);
    }

    if (method === 'POST' && url.pathname === '/login') {
      const form = await parseForm(req);
      const db = readDb();
      const normalizedEmail = (form.email || '').trim().toLowerCase();
      const found = db.users.find((item) => item.email === normalizedEmail);
      if (!found || found.passwordHash !== hashPassword(form.password || '')) {
        return redirect(res, '/?error=Invalid login details.');
      }
      return createSession(res, found.id);
    }

    if (method === 'GET' && url.pathname === '/dashboard') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const db = readDb();
      const userTransactions = db.transactions.filter((item) => item.userId === user.id);
      const month = url.searchParams.get('month') || currentMonth();
      const monthlyTransactions = userTransactions.filter((item) => item.month === month);
      const summary = summarize(monthlyTransactions);
      const errorMessage = url.searchParams.get('error') || '';
      return sendPage(res, renderLayout(renderDashboard(user, month, summary, monthlyTransactions, errorMessage), user));
    }

    if (method === 'POST' && url.pathname === '/transactions') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}&error=${encodeURIComponent(validationError)}`);
      }
      const db = readDb();
      db.transactions.push({
        id: crypto.randomUUID(),
        userId: user.id,
        month: form.month,
        type: form.type,
        category: form.category.trim(),
        amount: Number(form.amount),
        description: form.description.trim(),
        createdAt: new Date().toISOString()
      });
      writeDb(db);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}`);
    }

    if (method === 'POST' && url.pathname === '/transactions/update') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const validationError = validateTransaction(form);
      if (validationError || !form.id) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}&error=${encodeURIComponent(validationError || 'Transaction not found.')}`);
      }
      const db = readDb();
      const transaction = db.transactions.find((item) => item.id === form.id && item.userId === user.id);
      if (!transaction) {
        return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}&error=Transaction not found.`);
      }
      Object.assign(transaction, {
        month: form.month,
        type: form.type,
        category: form.category.trim(),
        amount: Number(form.amount),
        description: form.description.trim(),
        updatedAt: new Date().toISOString()
      });
      writeDb(db);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month)}`);
    }

    if (method === 'POST' && url.pathname === '/profile') {
      if (!user) {
        return redirect(res, '/?error=Please log in first.');
      }
      const form = await parseForm(req);
      const db = readDb();
      const dbUser = db.users.find((item) => item.id === user.id);
      dbUser.profile = {
        monthlyIncomeTarget: Number(form.monthlyIncomeTarget || 0),
        monthlyBudgetTarget: Number(form.monthlyBudgetTarget || 0),
        notes: form.notes?.trim() || ''
      };
      writeDb(db);
      return redirect(res, `/dashboard?month=${encodeURIComponent(form.month || currentMonth())}`);
    }

    if (method === 'POST' && url.pathname === '/logout') {
      if (cookies.sid) {
        sessions.delete(cookies.sid);
      }
      res.writeHead(302, {
        'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0',
        Location: '/'
      });
      return res.end();
    }

    sendNotFound(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderLayout(`<section class="card"><h1>Server error</h1><p>${escapeHtml(error.message)}</p></section>`));
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    writeDb({ users: [], transactions: [] });
  }
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUserById(id) {
  const db = readDb();
  return db.users.find((item) => item.id === id) || null;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const result = {};
      for (const [key, value] of params.entries()) result[key] = value;
      resolve(result);
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createSession(res, userId) {
  const sid = crypto.randomUUID();
  sessions.set(sid, { userId, createdAt: Date.now() });
  res.writeHead(302, {
    'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=86400`,
    Location: '/dashboard'
  });
  res.end();
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendPage(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(renderLayout('<section class="card"><h1>404</h1><p>Page not found.</p></section>'));
}

function serveStatic(req, res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    return sendNotFound(res);
  }
  const ext = path.extname(filePath);
  const types = { '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
}

function validateRegistration(form) {
  if (!form.name?.trim()) return 'Name is required.';
  if (!form.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'A valid email is required.';
  if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

function validateTransaction(form) {
  if (!/^\d{4}-\d{2}$/.test(form.month || '')) return 'Month is required in YYYY-MM format.';
  if (!['income', 'expense'].includes(form.type)) return 'Type must be income or expense.';
  if (!form.category?.trim()) return 'Category is required.';
  if (!form.description?.trim()) return 'Description is required.';
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than zero.';
  return '';
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function summarize(transactions) {
  return transactions.reduce((acc, item) => {
    if (item.type === 'income') acc.income += item.amount;
    if (item.type === 'expense') acc.expense += item.amount;
    acc.balance = acc.income - acc.expense;
    return acc;
  }, { income: 0, expense: 0, balance: 0 });
}

function renderLayout(content, user = null) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>FinanceFlow</title>
      <link rel="stylesheet" href="/public/styles.css" />
    </head>
    <body>
      <header class="topbar">
        <div>
          <span class="brand">FinanceFlow</span>
          <p class="tagline">Simple Node.js finance portal for future IaC hosting workflows.</p>
        </div>
        ${user ? `<form method="post" action="/logout"><button class="ghost-button" type="submit">Logout</button></form>` : '<span class="badge">Local JSON DB</span>'}
      </header>
      <main>${content}</main>
    </body>
  </html>`;
}

function renderHomePage(errorMessage) {
  return `
    <section class="hero">
      <div class="intro card">
        <h1>Login or create your account</h1>
        <p>New users can create an account with name and email, and existing users can log in to access a month-wise financial dashboard.</p>
        ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
      </div>
      <div class="auth-grid">
        <section class="card">
          <h2>Existing user login</h2>
          <form method="post" action="/login" class="stack">
            <label>Email<input type="email" name="email" required /></label>
            <label>Password<input type="password" name="password" required /></label>
            <button type="submit">Login</button>
          </form>
        </section>
        <section class="card">
          <h2>New user signup</h2>
          <form method="post" action="/register" class="stack">
            <label>Full name<input type="text" name="name" required /></label>
            <label>Email<input type="email" name="email" required /></label>
            <label>Password<input type="password" name="password" minlength="6" required /></label>
            <label>Monthly income target<input type="number" step="0.01" name="monthlyIncomeTarget" value="0" /></label>
            <label>Monthly budget target<input type="number" step="0.01" name="monthlyBudgetTarget" value="0" /></label>
            <label>Financial notes<textarea name="notes" rows="3" placeholder="Savings goal, loan reminder, etc."></textarea></label>
            <button type="submit">Create account</button>
          </form>
        </section>
      </div>
    </section>`;
}

function renderDashboard(user, month, summary, transactions, errorMessage) {
  const transactionRows = transactions.length ? transactions.map((item) => `
      <tr>
        <td>${escapeHtml(item.month)}</td>
        <td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>$${item.amount.toFixed(2)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>
          <details>
            <summary>Edit</summary>
            <form method="post" action="/transactions/update" class="stack compact-form">
              <input type="hidden" name="id" value="${item.id}" />
              <label>Month<input type="month" name="month" value="${item.month}" required /></label>
              <label>Type
                <select name="type">
                  <option value="income" ${item.type === 'income' ? 'selected' : ''}>Income</option>
                  <option value="expense" ${item.type === 'expense' ? 'selected' : ''}>Expense</option>
                </select>
              </label>
              <label>Category<input type="text" name="category" value="${escapeHtml(item.category)}" required /></label>
              <label>Amount<input type="number" step="0.01" name="amount" value="${item.amount}" required /></label>
              <label>Description<input type="text" name="description" value="${escapeHtml(item.description)}" required /></label>
              <button type="submit">Save changes</button>
            </form>
          </details>
        </td>
      </tr>`).join('') : '<tr><td colspan="6">No transactions saved for this month yet.</td></tr>';

  return `
    <section class="dashboard-grid">
      <section class="card wide">
        <div class="section-title">
          <div>
            <h1>Welcome, ${escapeHtml(user.name)}</h1>
            <p>Track monthly earnings and expenditure from a single place.</p>
            ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''}
          </div>
          <form method="get" action="/dashboard" class="inline-form">
            <label>Month view<input type="month" name="month" value="${month}" /></label>
            <button type="submit">Load</button>
          </form>
        </div>
        <div class="stats">
          <article class="stat income"><span>Income</span><strong>$${summary.income.toFixed(2)}</strong></article>
          <article class="stat expense"><span>Expense</span><strong>$${summary.expense.toFixed(2)}</strong></article>
          <article class="stat balance"><span>Balance</span><strong>$${summary.balance.toFixed(2)}</strong></article>
        </div>
      </section>

      <section class="card">
        <h2>Add transaction</h2>
        <form method="post" action="/transactions" class="stack">
          <label>Month<input type="month" name="month" value="${month}" required /></label>
          <label>Type
            <select name="type">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label>Category<input type="text" name="category" placeholder="Salary, Food, Rent" required /></label>
          <label>Amount<input type="number" step="0.01" name="amount" required /></label>
          <label>Description<input type="text" name="description" placeholder="Monthly salary / grocery bill" required /></label>
          <button type="submit">Save transaction</button>
        </form>
      </section>

      <section class="card">
        <h2>Financial details</h2>
        <form method="post" action="/profile" class="stack">
          <input type="hidden" name="month" value="${month}" />
          <label>Monthly income target<input type="number" step="0.01" name="monthlyIncomeTarget" value="${user.profile?.monthlyIncomeTarget || 0}" /></label>
          <label>Monthly budget target<input type="number" step="0.01" name="monthlyBudgetTarget" value="${user.profile?.monthlyBudgetTarget || 0}" /></label>
          <label>Financial notes<textarea name="notes" rows="4">${escapeHtml(user.profile?.notes || '')}</textarea></label>
          <button type="submit">Save financial details</button>
        </form>
      </section>

      <section class="card wide">
        <h2>Transaction history</h2>
        <table>
          <thead>
            <tr><th>Month</th><th>Type</th><th>Category</th><th>Amount</th><th>Description</th><th>Edit</th></tr>
          </thead>
          <tbody>${transactionRows}</tbody>
        </table>
      </section>
    </section>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
