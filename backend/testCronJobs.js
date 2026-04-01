import express from 'express';
import dotenv from 'dotenv';
import { processScheduledContributions } from './services/contributionScheduler.js';
import { processScheduledPayouts } from './services/payoutScheduler.js';
import connectDB from './config/database.js';

/**
 * Manual Cron Job Tester
 * Run this script to manually trigger cron jobs for testing
 * 
 * Usage:
 *   node testCronJobs.js contributions
 *   node testCronJobs.js payouts
 *   node testCronJobs.js all
 */

dotenv.config();

const testCronJobs = async () => {
    try {
        // Connect to database
        await connectDB();

        const command = process.argv[2] || 'all';

        console.log('\n🧪 Testing CircSave Cron Jobs\n');
        console.log('='.repeat(50));

        if (command === 'contributions' || command === 'all') {
            console.log('\n🕐 Testing Contribution Auto-Debit...\n');
            const contributionResult = await processScheduledContributions();
            console.log('\n📊 Contribution Results:');
            console.log(`   ✓ Processed: ${contributionResult.processed}`);
            console.log(`   ✓ Succeeded: ${contributionResult.succeeded}`);
            console.log(`   ✗ Failed: ${contributionResult.failed}`);
        }

        if (command === 'payouts' || command === 'all') {
            console.log('\n💰 Testing Automated Payouts...\n');
            const payoutResult = await processScheduledPayouts();
            console.log('\n📊 Payout Results:');
            console.log(`   ✓ Processed: ${payoutResult.processed}`);
            console.log(`   ✓ Succeeded: ${payoutResult.succeeded}`);
            console.log(`   ✗ Failed: ${payoutResult.failed}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ Test complete!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error testing cron jobs:', error);
        process.exit(1);
    }
};

testCronJobs();
