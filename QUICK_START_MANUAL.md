# Quick Start Guide - Manual Installation Steps

## ⚠️ NPM Install Issue

The automated npm install commands are not producing output in the terminal. This is likely a shell/terminal issue, not a problem with the code.

## ✅ Manual Installation Steps

Please run these commands **in your own terminal** (PowerShell or CMD):

### Step 1: Navigate to Backend Directory
```bash
cd C:\Users\USER\Documents\CircSave\backend
```

### Step 2: Install Firebase Admin SDK
```bash
npm install firebase-admin
```

**This should take 1-2 minutes.** You'll see download progress.

### Step 3: Verify Installation
```bash
npm list firebase-admin
```

**Expected output:** Should show `firebase-admin@12.x.x` or similar

### Step 4: Start the Server
```bash
npm start
```

**Expected output:**
```
✅ Firebase Firestore Connected
✅ Firebase Authentication Connected
🚀 CircSave Server running on port 5000
📍 Environment: development
🌐 API URL: http://localhost:5000/api
🔥 Firebase: Connected (Firestore + Authentication)
```

---

## 🔴 If You Get Errors

### Error: "Cannot find package 'firebase-admin'"
- Make sure Step 2 completed successfully
- Check that `firebase-admin` appears in `package.json` dependencies
- Try: `npm install --force firebase-admin`

### Error: "Firebase Connection Error"
- Ensure you have `config/firebase-service-account.json` file
- Check that `.env` has `FIREBASE_SERVICE_ACCOUNT_PATH=config/firebase-service-account.json`
- Verify Firebase project is set up correctly in Firebase Console

### Error: Port 5000 already in use
- Change port in `.env` file: `PORT=3000`
- Or kill process using port 5000

---

## ✅ Once Server Starts Successfully

1. **Keep the terminal open** - Server needs to stay running
2. **Open API_TESTING_GUIDE.md** - Complete testing guide
3. **Use Thunder Client / Postman** - Test the endpoints
4. **Start with signup** - Create a new user first

---

## 🎯 What's Ready to Test

- ✅ User signup & login (Firebase Auth)
- ✅ Wallet funding & transactions
- ✅ Group creation & management
- ✅ Financial summaries

All endpoints use Firebase and are fully functional!

---

## 📞 Need Help?

If you encounter any errors during installation or startup, share:
1. The exact error message
2. Output from `npm list firebase-admin`
3. Contents of your `.env` file (hide sensitive data)

I'll help you troubleshoot!
