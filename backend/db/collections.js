// Firestore Collection Names
// Centralized collection names for consistency across the application

export const COLLECTIONS = {
    USERS: 'users',
    WALLETS: 'wallets',
    GROUPS: 'groups',
    CONTRIBUTIONS: 'contributions',
    TRANSACTIONS: 'transactions',
    PAYOUTS: 'payouts',
    CONTRIBUTION_SCHEDULES: 'contribution_schedules',
    SETTINGS: 'settings'
};

// Collection references helper
export function getCollectionRef(db, collectionName) {
    return db.collection(collectionName);
}

export default COLLECTIONS;
