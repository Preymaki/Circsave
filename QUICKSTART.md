# CircSave - Quick Start Guide

## ✅ Phase 2 Complete - Ready to Test!

You now have a fully functional group management system. Follow these steps to test it:

---

## 📋 Prerequisites

Before running the app, ensure you have:
- ✅ **Node.js** (v18+) installed
- ✅ **MongoDB** running locally or MongoDB Atlas account
- ⚠️ **Google Gemini API Key** (optional for now, AI features can be added later)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies

Open **TWO** terminal windows in the CircSave directory:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Configure Environment

**Backend Configuration:**
1. Rename `backend/.env.local` to `backend/.env`
2. The file already has default settings that will work for local testing
3. **Important**: Make sure MongoDB is running on `mongodb://localhost:27017`

**Frontend Configuration:**
- The frontend is already configured to connect to `http://localhost:5000/api`

### Step 3: Start the Servers

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
```
Wait for: `✅ MongoDB Connected` and `🚀 CircSave Server running on port 5000`

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```
Wait for: `Local: http://localhost:5173/`

---

## 🧪 Testing Phase 2 Features

### Test 1: User Registration & Login
1. Open http://localhost:5173
2. Click "Sign up" and create an account with:
   - Full name
   - Email
   - Password (min 6 characters)
   - Phone number
   - Address
3. You'll be automatically logged in and redirected to the dashboard

### Test 2: Create a Group
1. Click "Create New Group" on the dashboard
2. Fill in the form:
   - **Group Name**: "Test Savings Circle"
   - **Description**: "Testing the app"
   - **Contribution Amount**: 10000
   - **Frequency**: Monthly
   - **Duration**: 3 Months
   - **Start Date**: Today's date
   - **Late Payment Penalty**: 500 (optional)
3. Click "Create Group"
4. You'll be redirected to the group detail page
5. **Note the 6-digit join code** displayed prominently

### Test 3: Join a Group (Second User)
1. Open a **new incognito/private window** at http://localhost:5173
2. Sign up with a different email
3. Click "Join Group" on the dashboard
4. Enter the 6-digit code from Test 2
5. Click "Join Group"
6. You should see the group details with your payout turn assigned

### Test 4: View Group Details
1. As the admin (first user), go to the group detail page
2. Verify you can see:
   - ✅ Join code with copy button
   - ✅ All members listed with payout turns
   - ✅ Member contact information (phone, address)
   - ✅ Group stats (contribution amount, frequency, cycles)
   - ✅ "Close Group" button
   - ✅ "Remove" button next to non-admin members

3. As a regular member (second user):
   - ✅ Can see group details
   - ✅ Cannot see other members' contact info
   - ✅ Cannot see admin controls

### Test 5: Dashboard Features
1. Return to the dashboard
2. Verify:
   - ✅ Active groups count is correct
   - ✅ Group cards show correct information
   - ✅ Clicking a group card navigates to group detail
   - ✅ Stats are displayed (Total Saved, Active Groups, Next Contribution)

### Test 6: Admin Functions
1. As admin, try removing a member from the group
2. Try closing the group
3. Verify closed groups appear in history (link in navigation)

---

## 🎯 What's Working in Phase 2

✅ **Authentication**
- User registration with full contact details
- Login with JWT tokens
- Protected routes
- Persistent sessions

✅ **Group Management**
- Create groups with flexible settings (1-6 months)
- Unique 6-digit join codes
- Join groups with code validation
- Automatic payout turn assignment
- Member management (admin can remove members)
- Group closure

✅ **User Interface**
- Beautiful gradient design
- Responsive layout
- Loading states
- Error handling
- Real-time data updates

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
❌ MongoDB Connection Error
```
**Solution**: Make sure MongoDB is running:
```bash
# Windows (if installed as service)
net start MongoDB

# Or start manually
mongod
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution**: Change the PORT in `backend/.env` to a different number (e.g., 5001)

### Frontend Can't Connect to Backend
**Solution**: Make sure:
1. Backend is running on port 5000
2. You see "🚀 CircSave Server running on port 5000" in the backend terminal
3. Frontend `.env` has `VITE_API_URL=http://localhost:5000/api`

---

## 📊 Current Status

**Completed:**
- ✅ Phase 1: Authentication System
- ✅ Phase 2: Group Management

**Next (Phase 3):**
- ⏳ Contribution tracking with receipt uploads
- ⏳ Admin verification system
- ⏳ AI fraud detection
- ⏳ Late payment penalties
- ⏳ Automated reminders

---

## 💡 Tips

1. **Use Chrome DevTools**: Open F12 to see network requests and console logs
2. **Check Backend Logs**: Watch the backend terminal for API requests
3. **Test with Multiple Users**: Use incognito windows to simulate different users
4. **MongoDB Compass**: Use MongoDB Compass to view database collections

---

## 🎉 Success Criteria

You'll know Phase 2 is working correctly when:
- ✅ You can create an account and login
- ✅ You can create a group and see the join code
- ✅ Another user can join using the code
- ✅ Dashboard shows active groups
- ✅ Group detail page displays all information
- ✅ Admin can manage members

---

**Ready to test!** Start with Step 1 above and work through the test scenarios. 🚀
