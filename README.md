# FinanceFlow Node.js Demo

FinanceFlow is a simple Node.js website for login, signup, and month-wise finance tracking that stores everything in a built-in local JSON database.

## Features

- New user registration with name, email, password, and financial profile fields.
- Existing user login.
- Dashboard with month-wise income, expense, balance, and overall balance.
- Create, edit, and delete transactions.
- Save financial details in one place for later reuse.
- Open a separate financial-items page to store insurance records for term, life, health, motor, and property policies.
- Local JSON data store that is easy to carry into future IaC and hosting pipelines.

## Tech approach

This implementation intentionally uses only built-in Node.js modules so it can run in minimal environments before being integrated with tools like Ansible, Docker, Terraform, or CI/CD systems.
A simple Node.js finance tracking site with:

- Login and account creation.
- Local inbuilt JSON database storage for users and transactions.
- Month-wise dashboard for earnings, expenditure, and net balance.
- Editable transactions.
- A single form for core financial details such as targets and notes.

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Validate
Open `http://localhost:3000`.

## Validation checks

```bash
npm run check
```

## Data location

All app data is stored in:

```text
data/db.json
```

## Git repository usage

If you want to push this project to an external remote later, connect a remote and push the current branch:
## Data storage

Data is stored in `data/db.json`, so the project can be reused later in IaC and hosting workflows.

## Git hosting

To publish this to a fresh remote repository later:

```bash
git remote add origin <your-new-repository-url>
git push -u origin HEAD
```
