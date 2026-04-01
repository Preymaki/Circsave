# CircSave System Architecture

## Overview
CircSave is a web-based platform designed to digitize and automate savings circles (also known as ROSCAs). It facilitates group creation, contribution tracking, automated wallet debits, and cycle-based payouts.

## Technology Stack

### Frontend (Client-Side)
- **Framework**: React.js (v18+)
- **Build Tool**: Vite
- **Language**: JavaScript (ES6+)
- **Styling**: TailwindCSS (Utility-first CSS)
- **State Management**: React Context API
- **Routing**: React Router DOM
- **HTTP Client**: Native Fetch API / Axios (implied)

### Backend (Server-Side)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (ES Modules)
- **Architecture**: MVC (Model-View-Controller) with Service Layer pattern

### Database
- **Primary Store**: MongoDB
- **ODM**: Mongoose
- **Data Model**: Relational-like references (Users <-> Groups <-> Contributions)

### Infrastructure & Services
- **Background Jobs**: Node-cron (for automated contributions and payouts)
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Local filesystem (serving static assets), transitioning to wallet-only flows.

---

## core System Components

### 1. User & Authentication Service
- **Routes**: `/api/auth`
- **Responsibilities**: 
  - User registration and login
  - JWT issuance and verification
  - Profile management
  - Wallet creation upon registration

### 2. Wallet System (Core Financial Ledger)
- **Routes**: `/api/wallet`
- **Responsibilities**:
  - Managing user balances
  - Processing deposits and withdrawals
  - Handling internal transfers (Contribution payments, Payout receipts)
  - Recording transaction history

### 3. Group Management Service
- **Routes**: `/api/groups`
- **Responsibilities**:
  - creating and configuring savings circles
  - Managing membership (Invite code system)
  - Defining schedules (Daily, Weekly, Monthly)
  - Tracking cycle progress

### 4. Contribution & Payout Automation
- **Routes**: `/api/contributions`, `/api/admin/trigger*`
- **Components**: `contributionScheduler.js`, `payoutScheduler.js`
- **Responsibilities**:
  - **Auto-Debit**: Cron jobs run hourly to check for due contributions and debit user wallets.
  - **Auto-Payout**: Cron jobs run periodically to distribute pooled funds to the member whose turn it is.
  - **State Management**: Updating contribution status (PENDING -> PAID / FAILED).


---

## Data Flow Architecture

```mermaid
graph TD
    Client[React Frontend] <-->|HTTP/REST| API[Express API Gateway]
    
    subgraph Backend Services
        API --> Auth[Auth Controller]
        API --> Wallet[Wallet Controller]
        API --> Groups[Group Controller]
        
        Cron[Cron Scheduler] -->|Triggers| AutoDebit[Contribution Service]
        Cron -->|Triggers| AutoPayout[Payout Service]
        
        AutoDebit -->|Updates| DB[(MongoDB)]
        AutoPayout -->|Updates| DB
        
        Auth --> DB
        Wallet --> DB
        Groups --> DB
    end
```

## Directory Structure
- **`/frontend`**: React SPA source code.
- **`/backend`**:
  - **`/models`**: Mongoose schemas (User, Group, Wallet, Transaction, etc.)
  - **`/routes`**: API endpoint definitions.
  - **`/controllers`**: Request handling logic.
  - **`/services`**: Reusable business logic (Scheduler, etc.)
  - **`/jobs`**: Cron job definitions.
  - **`/middleware`**: Auth checks, error handling.

## Deployment Strategy
- **Current**: Local Development (`localhost:5173` <-> `localhost:5000`)
- **Production (Proposed)**: 
  - Backend: Node.js capable host (Heroku, Render, AWS EC2)
  - Frontend: Static site host (Vercel, Netlify)
  - Database: MongoDB Atlas

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--|| Wallet : has
    User ||--o{ Group : "admin of"
    User ||--o{ Contribution : "makes"
    User ||--o{ ContributionSchedule : "has"
    User ||--o{ Payout : "receives"
    User ||--o{ Transaction : "initiates"

    Group ||--o{ User : "members (embedded array)"
    Group ||--o{ Contribution : "contains"
    Group ||--o{ ContributionSchedule : "has schedule"
    Group ||--o{ Payout : "processes"

    Wallet ||--o{ Transaction : "logs"

    Contribution |o--|| Transaction : "paid via (walletTransactionId)"
    Payout |o--|| Transaction : "paid via (walletTransactionId)"
    
    ContributionSchedule |o--|| Contribution : "fulfilled by"

    User {
        ObjectId _id PK
        String fullName
        String email
        String password
        String phoneNumber
        String address
        Date createdAt
        Date updatedAt
    }

    Wallet {
        ObjectId _id PK
        ObjectId userId FK
        Number availableBalance
        Number lockedBalance
        Number totalFunded
        Number totalSpent
        Date createdAt
        Date updatedAt
    }

    Group {
        ObjectId _id PK
        String name
        String description
        ObjectId adminId FK
        String joinCode
        Number contributionAmount
        String contributionFrequency "daily, weekly, monthly"
        Number contributionPeriodMonths
        Number totalCycles
        Number currentCycle
        Number maxMembers
        Number totalPerCycle
        Number totalPayout
        Number currentEscrowBalance
        Number totalContributed
        String savingsMode "group, individual"
        Boolean isInviteEnabled
        Number latePaymentPenalty
        String status "active, closed"
        Date startDate
        Date endDate
        Date closedAt
        Array members "userId, joinedAt, payoutTurn, hasReceivedPayout"
    }

    Contribution {
        ObjectId _id PK
        ObjectId groupId FK
        ObjectId userId FK
        Number cycleNumber
        Number amount
        String receiptUrl "Optional (Legacy)"
        ObjectId walletTransactionId FK
        Date dueDate
        Date paidAt
        Boolean isAutoDebited
        Date autoDebitedAt
        String status "scheduled, paid, missed, locked, released"
        Boolean isLate
        Number penaltyAmount
        String notes
    }

    ContributionSchedule {
        ObjectId _id PK
        ObjectId groupId FK
        ObjectId userId FK
        Number cycleNumber
        Date dueDate
        Number amount
        String status "pending, auto-debited, manually-submitted, missed, etc"
        Boolean autoDebitAttempted
        Date autoDebitedAt
        ObjectId contributionId FK
        String failureReason
        Number retryCount
    }

    Payout {
        ObjectId _id PK
        ObjectId groupId FK
        ObjectId recipientId FK
        Number cycleNumber
        Number amount
        Date scheduledDate
        Date paidAt
        ObjectId walletTransactionId FK
        String status "scheduled, processing, completed, failed"
        Boolean isAutomated
        Date processedAt
    }

    Transaction {
        ObjectId _id PK
        ObjectId walletId FK
        ObjectId userId FK
        String type "fund, lock, unlock, escrow_deposit, payout, ref..."
        Number amount
        Number balanceBefore
        Number balanceAfter
        String reference
        String description
        String status
        Object metadata "groupId, contributionId, payoutId"
    }
```
