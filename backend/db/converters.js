import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export function timestampToDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp._seconds !== undefined) {
        return new Timestamp(timestamp._seconds, timestamp._nanoseconds).toDate();
    }
    if (timestamp.toDate) return timestamp.toDate();
    return new Date(timestamp);
}

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
export function dateToTimestamp(date) {
    if (!date) return null;
    if (date instanceof Timestamp) return date;
    return Timestamp.fromDate(new Date(date));
}

/**
 * Convert Firestore document to plain object with ID
 */
export function docToObject(doc) {
    if (!doc || !doc.exists) return null;
    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Convert Firestore QuerySnapshot to array of objects
 */
export function querySnapshotToArray(snapshot) {
    if (!snapshot || snapshot.empty) return [];
    return snapshot.docs.map(doc => docToObject(doc));
}

/**
 * Prepare data for Firestore (convert dates, remove undefined)
 */
export function prepareForFirestore(data) {
    const prepared = {};

    for (const [key, value] of Object.entries(data)) {
        // Skip undefined values (Firestore doesn't support them)
        if (value === undefined) continue;

        // *** CRITICAL: pass FieldValue sentinels (serverTimestamp, increment,
        //     arrayUnion, arrayRemove, etc.) through unchanged. If we recurse
        //     into them they are destroyed and nothing is stored in Firestore. ***
        if (value instanceof FieldValue) {
            prepared[key] = value;
        }
        // *** CRITICAL: pass Firestore Timestamps through unchanged.
        //     Timestamps read from transaction.get() / doc.data() are Timestamp
        //     instances.  If we recurse into them (they look like plain objects)
        //     they get stored as plain maps instead of Timestamp fields, which
        //     can cause the entire write to be rejected by the Admin SDK. ***
        else if (value instanceof Timestamp) {
            prepared[key] = value;
        }
        // Convert JS Date objects to Firestore Timestamps
        else if (value instanceof Date) {
            prepared[key] = Timestamp.fromDate(value);
        }
        // Handle nested objects
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
            prepared[key] = prepareForFirestore(value);
        }
        // Handle arrays
        else if (Array.isArray(value)) {
            prepared[key] = value.map(item =>
                item && typeof item === 'object' ? prepareForFirestore(item) : item
            );
        }
        // Keep primitive values as-is
        else {
            prepared[key] = value;
        }
    }

    return prepared;
}


/**
 * Get server timestamp
 */
export function serverTimestamp() {
    return FieldValue.serverTimestamp();
}

/**
 * Increment a numeric field
 */
export function increment(value) {
    return FieldValue.increment(value);
}

/**
 * Array union (add to array if not exists)
 */
export function arrayUnion(...elements) {
    return FieldValue.arrayUnion(...elements);
}

/**
 * Array remove
 */
export function arrayRemove(...elements) {
    return FieldValue.arrayRemove(...elements);
}

/**
 * Convert Firestore Decimal/Number to string for precision
 */
export function decimalToString(num) {
    if (num === null || num === undefined) return '0.00';
    return Number(num).toFixed(2);
}

/**
 * Convert string to number for Firestore
 */
export function stringToDecimal(str) {
    if (!str) return 0;
    return parseFloat(str);
}

export default {
    timestampToDate,
    dateToTimestamp,
    docToObject,
    querySnapshotToArray,
    prepareForFirestore,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove,
    decimalToString,
    stringToDecimal
};
