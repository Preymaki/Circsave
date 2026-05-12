# CircSave - Savings Circle Management System

A web-based platform for digitizing traditional cooperative savings circles (Ajo/Esusu/Isusu), providing transparency and automated management for community-based financial systems.

## 🎯 Project Overview

CircSave addresses the inefficiencies of manual record-keeping in traditional cooperative savings systems by providing:
- **Digital Record Keeping**: Automated contribution tracking and verification
- **Transparency**: Clear financial tracking and admin approval system
- **Community Focus**: Dedicated platform for group savings management
- **Automated Wallet System**: In-app wallet for contributions and payouts

## 🚀 Features

- ✅ User authentication (Login/Signup)
- ✅ Personalized dashboard with savings visualization
- 🔄 Group creation and management (In Progress)
- 🔄 Join groups with unique codes
- 🔄 Contribution tracking with wallet integration
- 🔄 Admin verification system
- 🔄 Automated contribution reminders
- 🔄 Late payment penalties
- 🔄 Flexible contribution periods (1-6 months)
- 🔄 Group history archive

## 🛠️ Technology Stack

### Frontend
- React 18 with Vite
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- Recharts for data visualization
- Lucide React for icons

### Backend
- Node.js with Express.js
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- Nodemailer for email notifications
- Node-cron for scheduled tasks

## 📋 Prerequisites

Before running this project, ensure you have:
- Node.js (v18 or higher)


## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
cd c:\Users\USER\Documents\CircSave
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=5000
NODE_ENV=development



# Email Service (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads/receipts

# Reminders
REMINDER_DAYS_BEFORE=3,1,0

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:5000/api
```


```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

## 📁 Project Structure

```
CircSave/
├── backend/
│   ├── config/          # Database and AI configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, upload, admin check
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── services/        # Business logic (AI, email, etc.)
│   ├── utils/           # Helper functions
│   ├── uploads/         # Receipt storage
│   └── server.js        # Express app entry point
│
└── frontend/
    ├── src/
    │   ├── components/  # Reusable UI components
    │   ├── context/     # React context (Auth)
    │   ├── pages/       # Page components
    │   ├── utils/       # API utilities
    │   ├── App.jsx      # Main app component
    │   └── main.jsx     # Entry point
    ├── index.html
    └── vite.config.js

## 🧪 Testing

### Test Backend API
```bash
# Health check
curl http://localhost:5000/api/health

# Test signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"password123","phoneNumber":"1234567890","address":"Test Address"}'
```

## 📝 Current Status

**Phase 1: Project Setup & Authentication** ✅ COMPLETE
- Backend server with Express and MongoDB
- User authentication (signup/login)
- JWT token management
- Protected routes
- Frontend with React and Tailwind CSS
- Authentication context and routing

**Phase 2: Core Features** 🔄 IN PROGRESS
- Group creation and management
- Contribution tracking
- Wallet integration

## 🎓 Academic Context

This project is developed as a final year project addressing:
- **Problem**: Manual record-keeping inefficiencies in traditional cooperative savings
- **Solution**: Automated, AI-assisted digital platform
- **Scope**: Proof-of-concept focusing on usability and auditability
- **Exclusions**: Direct payment processing, bank API integration

## 👨‍💻 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📄 License

MIT License - This is an academic project.

## 🤝 Contributing

This is a final year project. For questions or suggestions, please contact the project author.

---

**Built with ❤️ for community-based financial inclusion**
