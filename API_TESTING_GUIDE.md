# CircSave API Testing Guide - Firebase Migration

## 🚀 Quick Start

### 1. Start the Server
```bash
cd backend
npm start
```

**Expected Output:**
```
✅ Firebase Firestore Connected
✅ Firebase Authentication Connected
🚀 CircSave Server running on port 5000
📍 Environment: development
🌐 API URL: http://localhost:5000/api
🔥 Firebase: Connected (Firestore + Authentication)
```

---

## 📝 Testing with Thunder Client / Postman

### Step 1: Create a New User (Signup)

**Endpoint:** `POST http://localhost:5000/api/auth/signup`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phoneNumber": "+1234567890"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "firebase-uid-here",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890"
    },
    "customToken": "eyJhbGc..."
  }
}
```

**Save this customToken!** You'll need it for authentication.

---

### Step 2: Login (Get Custom Token)

**Endpoint:** `POST http://localhost:5000/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Login successful. Use customToken to authenticate with Firebase.",
  "data": {
    "user": {
      "id": "firebase-uid-here",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890"
    },
    "customToken": "eyJhbGc..."
  }
}
```

---

### Step 3: Get User Profile

**Endpoint:** `GET http://localhost:5000/api/auth/profile`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
Content-Type: application/json
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "firebase-uid-here",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+1234567890",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

## 💰 Wallet Operations

### Get Wallet Balance

**Endpoint:** `GET http://localhost:5000/api/wallet`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "firebase-uid-here",
      "userId": "firebase-uid-here",
      "availableBalance": 0,
      "lockedBalance": 0,
      "totalFunded": 0,
      "totalSpent": 0
    }
  }
}
```

---

### Fund Wallet

**Endpoint:** `POST http://localhost:5000/api/wallet/fund`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "amount": 50000,
  "description": "Initial wallet funding"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Wallet funded successfully",
  "data": {
    "wallet": {
      "id": "firebase-uid-here",
      "availableBalance": 50000,
      "lockedBalance": 0,
      "totalFunded": 50000,
      "totalSpent": 0
    }
  }
}
```

---

### Get Transaction History

**Endpoint:** `GET http://localhost:5000/api/wallet/transactions?limit=10&skip=0`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction-id",
        "type": "fund",
        "amount": 50000,
        "balanceBefore": 0,
        "balanceAfter": 50000,
        "description": "Initial wallet funding",
        "status": "completed",
        "createdAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "total": 1,
    "hasMore": false
  }
}
```

---

## 👥 Group Operations

### Create a Group

**Endpoint:** `POST http://localhost:5000/api/groups`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Friends Savings Circle",
  "description": "Monthly savings for our group vacation",
  "contributionAmount": 5000,
  "contributionFrequency": "monthly",
  "contributionPeriodMonths": 6,
  "maxMembers": 6,
  "latePaymentPenalty": 500
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "group": {
      "id": "group-id-here",
      "name": "Friends Savings Circle",
      "joinCode": "ABC123",
      "adminId": "firebase-uid-here",
      "contributionAmount": 5000,
      "contributionFrequency": "monthly",
      "totalCycles": 6,
      "currentCycle": 1,
      "maxMembers": 6,
      "status": "active",
      "members": [
        {
          "userId": "firebase-uid-here",
          "payoutTurn": 1,
          "hasReceivedPayout": false
        }
      ]
    }
  }
}
```

**Save the joinCode!** Other users will need this to join.

---

### Get My Groups

**Endpoint:** `GET http://localhost:5000/api/groups`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "activeGroups": [
      {
        "id": "group-id",
        "name": "Friends Savings Circle",
        "contributionAmount": 5000,
        "members": [...]
      }
    ],
    "closedGroups": [],
    "total": 1
  }
}
```

---

### Get Group Details

**Endpoint:** `GET http://localhost:5000/api/groups/:groupId`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "group-id",
      "name": "Friends Savings Circle",
      "description": "Monthly savings for our group vacation",
      "joinCode": "ABC123",
      "contributionAmount": 5000,
      "members": [
        {
          "userId": "firebase-uid",
          "payoutTurn": 1,
          "userDetails": {
            "id": "firebase-uid",
            "fullName": "John Doe",
            "email": "john@example.com"
          }
        }
      ]
    },
    "isAdmin": true
  }
}
```

---

### Join a Group

**Endpoint:** `POST http://localhost:5000/api/groups/join`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "joinCode": "ABC123"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Successfully joined group",
  "data": {
    "groupId": "group-id-here"
  }
}
```

---

### Get Financial Summary

**Endpoint:** `GET http://localhost:5000/api/groups/:groupId/financial-summary`

**Headers:**
```
Authorization: Bearer <YOUR_CUSTOM_TOKEN>
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "totalContributed": 0,
    "currentEscrowBalance": 0,
    "totalPayout": 5000,
    "contributionAmount": 5000,
    "currentCycle": 1,
    "totalCycles": 6,
    "completedCycles": 0,
    "completionPercentage": 0,
    "nextPayoutRecipient": {
      "userId": "firebase-uid",
      "fullName": "John Doe",
      "payoutTurn": 1
    },
    "memberCount": 1,
    "maxMembers": 6
  }
}
```

---

## ⚠️ Known Limitations (Still Being Migrated)

The following features are **NOT YET AVAILABLE** as they're still being converted:

- ❌ Contribution submission (still uses Mongoose)
- ❌ Contribution verification (still uses Mongoose)
- ❌ Automated contribution scheduling (still uses Mongoose)
- ❌ Automated payout processing (still uses Mongoose)
- ❌ Admin middleware (still uses Mongoose)

These will be available soon!

---

## ✅ What's Working Now

- ✅ User signup with Firebase Auth
- ✅ User login with custom tokens
- ✅ User profile retrieval
- ✅ Wallet funding
- ✅ Wallet balance checking
- ✅ Transaction history
- ✅ Group creation
- ✅ Join group with code
- ✅ Get group details
- ✅ Financial summaries
- ✅ All operations use Firestore with atomic transactions

---

## 🐛 Troubleshooting

### Server won't start
- Ensure Firebase service account JSON is in `backend/config/firebase-service-account.json`
- Check that `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH=config/firebase-service-account.json`

### "Firebase Connection Error"
- Verify your Firebase project is set up correctly
- Check that Firestore and Authentication are enabled

### "Not authorized to access this route"
- Make sure you're including the Authorization header
- Use the customToken from signup/login response

### "Invalid or expired token"
- The custom token may have expired
- Login again to get a fresh token

---

## 📊 Test Workflow

1. **Create User** → Signup
2. **Fund Wallet** → Add money to wallet
3. **Create Group** → Set up savings circle
4. **Invite Friend** → Share join code
5. **Check Balance** → View wallet
6. **View Group** → See group details

---

Happy Testing! 🎉
