# SPAR-KG User Interface

A dashboard application for monitoring and analyzing drug-related content across social media platforms (Reddit, TikTok, YouTube).

## Project Structure

```
UserInterface/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── main.py
│   │   └── routers/
│   ├── requirements.txt
│   └── .env.example
└── frontend/         # Next.js React frontend
    ├── src/
    ├── package.json
    └── next.config.ts
```

## Prerequisites

- Python 3.9+
- Node.js 18+
- Google Cloud account with BigQuery access
- gcloud CLI installed

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/koncordantlab/SparKG-UI.git
cd SparKG-UI
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment:

- On macOS/Linux:
  ```bash
  source venv/bin/activate
  ```
- On Windows:
  ```bash
  venv\Scripts\activate
  ```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env` and set your Google Cloud project ID:

```
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

### 3. Google Cloud Authentication

Authenticate with Google Cloud to access BigQuery:

```bash
gcloud auth application-default login
```

This will open a browser window for authentication. Follow the prompts to complete the login.

### 4. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install Node.js dependencies:

```bash
npm install
```

### 5. Running the Application

Start the backend server (from the backend directory with venv activated):

```bash
uvicorn app.main:app --reload --port 8000
```

Start the frontend development server (from the frontend directory):

```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Your Google Cloud project ID with BigQuery access |

## Features

- Multi-platform data visualization (Reddit, TikTok, YouTube)
- Drug mention analytics and trends
- Behavioral analysis for TikTok videos
- Data export functionality
- Interactive filtering and search

## API Endpoints

The backend provides RESTful API endpoints under `/api/v1/dashboard/`:

- `/drugs` - Drug statistics for Reddit
- `/tiktok/drugs` - Drug statistics for TikTok
- `/youtube/drugs` - Drug statistics for YouTube
- `/tiktok/behavior/*` - Behavioral analysis endpoints
- `/export/*` - Data export endpoints

Full API documentation is available at http://localhost:8000/docs when the backend is running.

## Troubleshooting

### BigQuery Authentication Issues

If you encounter authentication errors:

1. Ensure gcloud CLI is installed and configured
2. Run `gcloud auth application-default login` again
3. Verify your project ID in the `.env` file
4. Check that your Google Cloud account has BigQuery permissions

### Port Already in Use

If port 8000 or 3000 is already in use:

- Backend: `uvicorn app.main:app --reload --port 8001`
- Frontend: `npm run dev -- -p 3001`

Update the frontend API proxy configuration if you change the backend port.
