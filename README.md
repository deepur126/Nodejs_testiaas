# FinanceFlow Node.js Demo

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

Open `http://localhost:3000`.

## Validation checks

```bash
npm run check
```

## Data storage

Data is stored in `data/db.json`, so the project can be reused later in IaC and hosting workflows.

## Git hosting

To publish this to a fresh remote repository later:

```bash
git remote add origin <your-new-repository-url>
git push -u origin HEAD
```
