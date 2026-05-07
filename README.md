# SQL Studio Pro

A high-performance, IDE-like SQL Server management tool with AI integration, real-time auditing, and advanced session monitoring.

Live Demo: [https://sql-server-tool.onrender.com/](https://sql-server-tool.onrender.com/)

---

## 🚀 Key Features

### 🔐 Secure Authentication
- **Multi-Tenant Login:** Secure registration and login backed by MongoDB Atlas.
- **JWT Protection:** All API endpoints are secured with JSON Web Tokens.
- **Session Persistence:** Remembers your theme and workspace preferences across reloads.

### 🔌 Server Management
- **Saved Connections:** Save multiple SQL Server credentials (Host, Port, User) securely.
- **Connection Status:** Real-time visual indicators of your server connection health.
- **Quick Actions:** Connect and Disconnect directly from the saved servers list.

### 🔍 Advanced Object Explorer
- **Activity Log:** Track modified database objects over time.
- **User Session Audit:** Real-time monitoring of active users, their device names, and their **Last Executed Query**.
- **Deep Search:** Search inside object code (Stored Procedures, Views, Triggers) with high-speed indexing.
- **Query Inspector:** Inspect full session queries in a dedicated viewer with line numbers and copy-to-clipboard support.

### 🤖 AI Integration
- **Natural Language to SQL:** Generate complex queries using simple English via Groq AI.
- **Query Optimization:** Get AI suggestions to improve the performance of your SQL scripts.

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account (or local MongoDB)
- Groq API key (free tier available)

### Step 1: Installation
```bash
git clone https://github.com/Akash23536/sql-server-tool.git
cd sql-server-tool
npm run install:all
```

### Step 2: Configuration
Create a `.env` file in the `backend/` directory:
```bash
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_secure_random_string
```

### Step 3: Run Locally
```bash
npm run dev
```
- **Frontend:** [http://localhost:5174](http://localhost:5174)
- **Backend:** [http://localhost:5000](http://localhost:5000)

---

## 🌍 Deployment on Render

### Build & Start
1. **Build Command:** `npm run render-build`
2. **Start Command:** `npm run render-start`

### Environment Variables
Ensure you add `MONGO_URI`, `GROQ_API_KEY`, and `JWT_SECRET` in the Render dashboard's environment section.

---

## 📂 Project Structure
- `backend/`: Node.js/Express server with TypeScript, handling SQL connections and Auth.
- `frontend/`: React/Vite application with a premium, responsive dashboard.
- `root/`: Automated build and deployment scripts.

---

**Developed by [Akash](https://github.com/Akash23536)**
