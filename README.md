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

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## Validate

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

```bash
git remote add origin <your-new-repository-url>
git push -u origin HEAD
```
