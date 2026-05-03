# SQL Server Tool

Live Demo: https://sql-server-tool.onrender.com/

## Setup Instructions - Step by Step

Follow these steps to set up and run the project after cloning the repository.

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)
- Git
- A Groq API key (free tier available)

### Step 1: Clone the Repository
```bash
git clone https://github.com/Akash23536/sql-server-tool.git
cd sql-server-tool
```

### Step 2: Install All Dependencies
Run the install script to install dependencies for the root, backend, and frontend:
```bash
npm run install:all
```

This command will:
- Install root dependencies (concurrently)
- Install backend dependencies (typescript, express, dotenv, etc.)
- Install frontend dependencies (vite, react, etc.)

### Step 3: Get Your Groq API Key
1. Visit https://console.groq.com
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Click "Create New API Key"
5. Copy the generated API key

### Step 4: Configure Environment Variables
Create a `.env` file in the `backend/` directory with the following variables:

```bash
# backend/.env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
```

Replace `your_groq_api_key_here` with your actual Groq API key from Step 3.

### Step 5: Start the Development Server
Run both backend and frontend servers concurrently:
```bash
npm run dev
```

This will start:
- **Backend Server**: http://localhost:5000
- **Frontend (Vite) Server**: http://localhost:5173

### Step 6: Access the Application
- Open your browser and navigate to: **http://localhost:5173**
- The backend API is available at: **http://localhost:5000**

## Project Structure

```
sql-server-tool/
├── backend/           # Express.js server + API routes
│   ├── src/
│   │   ├── index.ts   # Server entry point
│   │   ├── app.ts     # Express app configuration
│   │   └── routes/    # API routes
│   └── .env           # Environment variables (create this)
├── frontend/          # React + Vite application
│   ├── src/
│   └── vite.config.ts
└── package.json       # Root package.json with scripts
```

## Available Scripts

### Root Level Commands
- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both frontend and backend
- `npm run start` - Start only the backend server (production)
- `npm run install:all` - Install dependencies for all packages

### Troubleshooting

**Issue**: "Groq API key not configured in backend .env file"
- **Solution**: Make sure `.env` file exists in the `backend/` folder and `GROQ_API_KEY` is set with your actual API key

**Issue**: Command not found (tsx, vite)
- **Solution**: Run `npm run install:all` to ensure all dependencies are installed

**Issue**: Port already in use
- **Solution**: Change the PORT in `backend/.env` or kill the process using the port

## Features
- AI-powered SQL query generation using Groq API
- SQL query analysis and optimization suggestions
- Responsive web interface
- Real-time API integration

---

**Need help?** Check the troubleshooting section or ensure all prerequisites are installed.
