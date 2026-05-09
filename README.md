# SQL Studio Pro 🚀

A premium, SSMS-inspired web-based SQL Server management tool designed for speed, beauty, and efficiency. Built with React, Node.js, and Groq AI.

Live Demo: [https://sql-server-tool.onrender.com/](https://sql-server-tool.onrender.com/)

---

## ✨ Modern Features

### 🎨 Premium UI/UX
- **SSMS Layout:** Familiar vertical/horizontal resizable panels for Object Explorer and Query Editor.
- **Glassmorphism Design:** Modern aesthetics with curated HSL colors, smooth transitions, and dark mode support.
- **Mobile Responsive:** Fully functional on mobile with touch-to-drag drawer support and responsive sidebars.
- **Micro-Animations:** Interactive hover effects and haptic feedback (on supported devices).

### 🔍 Advanced Object Explorer
- **Deep Search:** Search for any text, keyword, or dependency inside the code of Stored Procedures, Views, Triggers, and Agent Jobs.
- **Activity Log:** Real-time view of recently modified database objects.
- **Session Audit:** Monitor live user sessions, including their device names and **Last Executed Query**.
- **Object Compare:** Compare schema objects across different databases with visual existence checks.

### 🤖 Smart AI Assistant
- **Dynamic Model Discovery:** Automatically fetches the latest available models from Groq (Llama 3.3, Mixtral, etc.).
- **Smart Prompt Editor:** Multi-line AI prompt window with line numbers and auto-resizing.
- **SQL Generation:** Convert natural language instructions into high-performance SQL scripts instantly.

### 📊 Powerful Query Editor
- **Batch Support:** Handles the `GO` separator just like SSMS for multi-batch script execution.
- **Smart Results Drawer:** Resizable, touch-responsive drawer that doesn't overlap your code.
- **Excel Tool:** Export query results or database tables directly to Excel files, and import data back into SQL Server.
- **History & Undo:** Full history of your recent queries with undo/redo capabilities.

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas (for Auth and Auditing)
- Groq API Key (for AI features)
- SQL Server (target connection)

### 1. Installation
```bash
git clone https://github.com/Akash23536/sql-server-tool.git
cd sql-server-tool
npm run install:all
```

### 2. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb+srv://...
GROQ_API_KEY=gsk_...
JWT_SECRET=your_secret_string
```

### 3. Production Build
```bash
npm run build
```

### 4. Running the App
- **Development:** `npm run dev`
- **Production:** `npm run start`

---

## 🌍 Deployment on Render

This project is optimized for Render deployment:
1. **Build Command:** `npm run render-build`
2. **Start Command:** `npm run render-start`
3. **Environment Variables:** Set `MONGO_URI`, `GROQ_API_KEY`, and `JWT_SECRET` in the Render dashboard.

---

**Developed by [Akash](https://github.com/Akash23536)**
