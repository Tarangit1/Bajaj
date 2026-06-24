# Chitkara Full Stack Engineering Challenge — BFHL

**Author:** Tarangit Chhabra  
**Roll No:** 2310990904  
**Email:** tarangit0904.b23@chitkara.edu.in

---

## Live Links

| Resource | URL |
|---|---|
| Frontend | https://bajaj-swart-psi.vercel.app/ |
| API Base URL | https://bajaj-swart-psi.vercel.app/bfhl |

---

## API Specification

### `POST /bfhl`

**Request:**
```json
{
  "data": ["A->B", "A->C", "B->D"]
}
```

**Response:**
```json
{
  "user_id": "tarangit_chhabra_01062004",
  "email_id": "tarangit0904.b23@chitkara.edu.in",
  "college_roll_number": "2310990904",
  "hierarchies": [
    {
      "root": "A",
      "tree": { "A": { "B": { "D": {} }, "C": {} } },
      "depth": 3
    }
  ],
  "invalid_entries": [],
  "duplicate_edges": [],
  "summary": {
    "total_trees": 1,
    "total_cycles": 0,
    "largest_tree_root": "A"
  }
}
```

### `GET /bfhl`

Health check endpoint.

```json
{
  "operation_code": 1,
  "message": "BFHL API is running."
}
```

---

## Processing Rules

- **Valid edge format:** `X->Y` — single uppercase letters only, no self-loops
- **Invalid entries:** wrong format, self-loop, empty string, non-uppercase
- **Duplicate edges:** only first occurrence used; rest logged once in `duplicate_edges`
- **Multi-parent:** first-seen parent wins; extra parent edges silently dropped
- **Cycle detection:** cyclic groups get `has_cycle: true` and `tree: {}`, no `depth`
- **Depth:** count of nodes on the longest root-to-leaf path
- **Largest tree tiebreaker:** lexicographically smaller root wins

---

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Plain HTML / CSS / JavaScript
- **Hosting:** Vercel

---

## Run Locally

```bash
# Install dependencies
npm install

# Start server
npm start

# Server runs at http://localhost:5000
```

Open `http://localhost:5000` in browser — serves frontend + API together.

---

## Project Structure

```
.
├── public/
│   └── index.html      # Frontend UI
├── server.js           # Express API server
├── package.json
├── .gitignore
└── README.md
```
