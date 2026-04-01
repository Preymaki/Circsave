/**
 * Firestore Kobo Migration Script
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: multiply every monetary field by 100 (Naira → kobo).
 *
 * IDEMPOTENT: Docs already migrated are skipped (_kobo_migrated: true).
 * DRY RUN:     Set DRY_RUN=true to preview changes without writing.
 *
 * Usage:
 *   node backend/scripts/migrateToKobo.js             # live run
 *   DRY_RUN=true node backend/scripts/migrateToKobo.js  # dry run
 *
 * Prerequisites: Firestore credentials must be available via GOOGLE_APPLICATION_CREDENTIALS.
 */

import db from '../config/firebase.js';
import { COLLECTIONS } from '../db/collections.js';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 400; // Firestore limit is 500, stay well under

// ─── Field maps ───────────────────────────────────────────────────────────────

const MONETARY_FIELDS = {
    [COLLECTIONS.WALLETS]: [
        'availableBalance',
        'lockedBalance',
        'totalFunded',
        'totalSpent'
    ],
    [COLLECTIONS.GROUPS]: [
        'contributionAmount',
        'latePaymentPenalty',
        'totalPerCycle',
        'totalPayout',
        'currentEscrowBalance',
        'totalContributed'
    ],
    [COLLECTIONS.CONTRIBUTIONS]: [
        'amount',
        'penaltyAmount',
        'totalAmount'
    ],
    [COLLECTIONS.PAYOUTS]: [
        'amount',
        'grossPayout',
        'commission',
        'netPayout',
        'grossAmount'
    ],
    [COLLECTIONS.TRANSACTIONS]: [
        'amount',
        'balanceBefore',
        'balanceAfter',
        'grossAmount',
        'commission'
    ]
};

// Platform config has its own collection/doc
const SETTINGS_MONETARY_FIELDS = ['company_wallet_balance'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toKobo = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return value;
    return Math.round(value * 100);
};

const formatNaira = (v) => `₦${(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// ─── Migrate a collection ─────────────────────────────────────────────────────

async function migrateCollection(collectionName, fields) {
    console.log(`\n▶ Migrating ${collectionName} …`);
    const snapshot = await db.collection(collectionName).get();

    let skipped = 0;
    let migrated = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip already-migrated docs
        if (data._kobo_migrated === true) {
            skipped++;
            continue;
        }

        const updates = { _kobo_migrated: true };
        let anyChange = false;

        for (const field of fields) {
            const raw = data[field];
            if (raw == null) continue; // field not present — skip
            const converted = toKobo(raw);
            if (converted !== raw) {
                updates[field] = converted;
                anyChange = true;
                if (DRY_RUN) {
                    console.log(`  [DRY] ${collectionName}/${doc.id}.${field}: ${formatNaira(raw)} → ${converted} kobo`);
                }
            }
        }

        if (!anyChange) {
            // All fields missing or already 0 — still mark as migrated
        }

        if (!DRY_RUN) {
            batch.update(doc.ref, updates);
        }

        batchCount++;
        migrated++;

        // Commit batch at BATCH_SIZE
        if (batchCount >= BATCH_SIZE) {
            if (!DRY_RUN) await batch.commit();
            batch = db.batch();
            batchCount = 0;
            console.log(`  … committed ${BATCH_SIZE} docs`);
        }
    }

    // Commit remaining
    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
    }

    console.log(`  ✓ ${migrated} migrated, ${skipped} skipped (already done)`);
    return { migrated, skipped };
}

// ─── Migrate platform_config settings doc ────────────────────────────────────

async function migrateSettings() {
    console.log(`\n▶ Migrating settings/platform_config …`);
    const ref = db.collection(COLLECTIONS.SETTINGS).doc('platform_config');
    const doc = await ref.get();

    if (!doc.exists) {
        console.log('  ℹ platform_config does not exist — nothing to migrate.');
        return;
    }

    const data = doc.data();
    if (data._kobo_migrated === true) {
        console.log('  ✓ Already migrated — skipped.');
        return;
    }

    const updates = { _kobo_migrated: true };
    for (const field of SETTINGS_MONETARY_FIELDS) {
        const raw = data[field];
        if (raw == null) continue;
        const converted = toKobo(raw);
        updates[field] = converted;
        if (DRY_RUN) {
            console.log(`  [DRY] platform_config.${field}: ${formatNaira(raw)} → ${converted} kobo`);
        }
    }

    if (!DRY_RUN) {
        await ref.update(updates);
    }

    console.log('  ✓ platform_config migrated.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log(' CircSave Naira → Kobo Migration');
    console.log(` Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '⚠️  LIVE — data WILL be written'}`);
    console.log('═══════════════════════════════════════════════════════');

    const results = {};

    for (const [collection, fields] of Object.entries(MONETARY_FIELDS)) {
        results[collection] = await migrateCollection(collection, fields);
    }

    await migrateSettings();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' Migration Complete');
    let totalMigrated = 0;
    let totalSkipped = 0;
    for (const [col, r] of Object.entries(results)) {
        console.log(`  ${col}: ${r.migrated} migrated, ${r.skipped} skipped`);
        totalMigrated += r.migrated;
        totalSkipped += r.skipped;
    }
    console.log(`  Total: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    if (DRY_RUN) {
        console.log('\n  ⚠️  DRY RUN — no data was changed. Re-run without DRY_RUN=true to commit.');
    }
    console.log('═══════════════════════════════════════════════════════');

    process.exit(0);
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
