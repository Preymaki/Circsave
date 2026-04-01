# Firebase Setup Guide for CircSave

Follow these steps to set up Firebase for your CircSave project.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: **CircSave** (or your preferred name)
4. Click "Continue"
5. Disable Google Analytics (optional, you can enable it if needed)
6. Click "Create project"
7. Wait for project creation to complete
8. Click "Continue"

## Step 2: Enable Firestore Database

1. In the Firebase Console, click on "Firestore Database" in the left sidebar
2. Click "Create database"
3. Select "Start in **test mode**" (we'll secure it later)
4. Click "Next"
5. Select your preferred location (choose closest to your users)
6. Click "Enable"

## Step 3: Enable Firebase Authentication

1. In the Firebase Console, click on "Authentication" in the left sidebar
2. Click "Get started"
3. Click on "Email/Password" in the Sign-in method tab
4. Toggle "Email/Password" to **Enabled**
5. Click "Save"

## Step 4: Generate Service Account Key

1. Click on the gear icon (⚙️) next to "Project Overview" in the left sidebar
2. Click "Project settings"
3. Click on the "Service accounts" tab
4. Click "Generate new private key"
5. Click "Generate key"
6. A JSON file will be downloaded - **SAVE THIS FILE SECURELY!**
7. Rename the file to `firebase-service-account.json`
8. Move it to `c:\Users\USER\Documents\CircSave\backend\config\` directory

## Step 5: Get Firebase Web Config (for Frontend)

1. In Project Settings, click on the "General" tab
2. Scroll down to "Your apps" section
3. Click on the web icon (`</>`)
4. Enter app nickname: **CircSave Web**
5. Click "Register app"
6. Copy the `firebaseConfig` object - you'll need this for the frontend later
7. Click "Continue to console"

## Step 6: Verify Setup

Once you've completed these steps:
- ✅ Firebase project created
- ✅ Firestore Database enabled
- ✅ Firebase Authentication enabled (Email/Password)
- ✅ Service account key downloaded and saved
- ✅ Web config copied (for frontend)

You're ready to proceed with the backend implementation!

## Security Notes

> [!WARNING]
> - **NEVER commit** the `firebase-service-account.json` file to Git
> - Make sure it's listed in `.gitignore`
> - Keep this file secure - it has admin access to your Firebase project

## Next Steps

After completing this setup, the backend migration will:
1. Install Firebase Admin SDK
2. Configure Firebase with your service account
3. Replace all MongoDB operations with Firestore
4. Replace JWT authentication with Firebase Authentication
