# Atlas of Elite Thinkers

A full-stack graph application for exploring elite mathematical thinkers, their subfields, landmark papers, and lines of influence.

## Stack

- Backend: FastAPI + Neo4j
- Frontend: React + Vite + Cytoscape.js
- Seed graph:
  - Mathematics -> Partial Differential Equations -> Navier-Stokes
  - Researchers: Terence Tao, Jean Leray
  - Papers: Leray 1934, plus one modern Tao paper for a richer profile view

## Features

- Graph explorer with clickable nodes and detail panel
- Hierarchical subfield browser with expand/collapse
- Researcher profile page with influence graph
- Global search bar backed by `/search?q=`
- Researcher list + subfield filter backed by `/researchers`

## API

- `GET /health`
- `GET /graph`
- `GET /subfields`
- `GET /researchers?subfield=&search=`
- `GET /researchers/{slug}`
- `GET /search?q=`

## Project Structure

```text
.
|-- backend
|   |-- .env.example
|   |-- requirements.txt
|   |-- app
|   |   |-- main.py
|   |   |-- database.py
|   |   |-- schemas.py
|   |   |-- api
|   |   |   `-- routes.py
|   |   |-- core
|   |   |   `-- config.py
|   |   `-- services
|   |       |-- atlas_service.py
|   |       `-- seed_data.py
|   `-- scripts
|       `-- seed.py
|-- frontend
|   |-- .env.example
|   |-- package.json
|   |-- vite.config.js
|   |-- index.html
|   `-- src
|       |-- App.jsx
|       |-- main.jsx
|       |-- styles.css
|       |-- components
|       |   |-- GraphCanvas.jsx
|       |   |-- NodeDetailCard.jsx
|       |   |-- SearchBar.jsx
|       |   `-- SubfieldTree.jsx
|       |-- hooks
|       |   `-- useDebouncedValue.js
|       |-- lib
|       |   `-- api.js
|       `-- pages
|           |-- GraphPage.jsx
|           |-- ResearcherProfilePage.jsx
|           `-- SubfieldsPage.jsx
|-- docker-compose.yml
`-- README.md
```

## Run

### 1. Start Neo4j

From the project root:

```powershell
docker compose up -d neo4j
```

Neo4j Browser will be available at `http://localhost:7474`.

Default credentials from `docker-compose.yml`:

- Username: `neo4j`
- Password: `password123`

### 2. Run the FastAPI backend

From [backend](./backend):

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

If `python` is not available on your machine yet, install Python 3.11+ first and then rerun the commands above with your Python executable.

The backend auto-seeds Neo4j on startup when the graph is empty. You can also seed manually:

```powershell
python -m scripts.seed
```

### 3. Run the React frontend

From [frontend](./frontend):

```powershell
Copy-Item .env.example .env
cmd /c npm install
cmd /c npm run dev
```

The `cmd /c` prefix avoids PowerShell execution-policy issues with `npm.ps1`.

Frontend URL:

- `http://localhost:5173`

Backend URL:

- `http://localhost:8000`

## Notes

- CORS defaults to `http://localhost:5173`.
- Seed data is idempotent, so rerunning it will not duplicate nodes.
- The existing root files `app.js`, `index.html`, `server.js`, and `styles.css` were left untouched.
