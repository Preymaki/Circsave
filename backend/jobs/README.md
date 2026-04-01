# Cron Jobs - Automated Contribution & Payout Processing

## Overview
This directory contains the automated job schedulers for CircSave's contribution debits and payout processing.

## Files
- **`cronJobs.js`** - Main cron job configuration and scheduler setup

## Cron Schedules

### Contribution Auto-Debit
- **Frequency**: Every hour
- **Cron**: `0 * * * *`
- **Function**: `processScheduledContributions()`
- **Service**: `services/contributionScheduler.js`

### Automated Payouts
- **Frequency**: Every 6 hours
- **Cron**: `0 */6 * * *`
- **Function**: `processScheduledPayouts()`
- **Service**: `services/payoutScheduler.js`

## How It Works

The cron jobs are automatically initialized when the server starts via the import in `server.js`:
```javascript
import './jobs/cronJobs.js';
```

## Manual Testing

You can manually trigger the cron jobs for testing:

### Option 1: API Endpoints
```bash
# Trigger contribution processing
curl -X POST http://localhost:5000/api/admin/trigger-contributions

# Trigger payout processing
curl -X POST http://localhost:5000/api/admin/trigger-payouts
```

### Option 2: Test Script
```bash
# From backend directory
node testCronJobs.js all
```

## Monitoring

Watch the console output when cron jobs run:
```
🕐 [CRON] Running contribution auto-debit...
✓ Auto-debited ₦5000 from user John Doe for group Weekly Savers
Auto-debit complete: 3 succeeded, 1 failed out of 4 processed

💰 [CRON] Running automated payouts...
✓ Paid ₦20000 to Jane Smith from group Monthly Circle
Auto-payout complete: 2 succeeded, 0 failed out of 2 processed
```

## Configuration

To change the cron schedules, edit the cron expressions in `cronJobs.js`:

```javascript
// Every hour (current)
cron.schedule('0 * * * *', ...)

// Every 30 minutes
cron.schedule('*/30 * * * *', ...)

// Every 3 hours
cron.schedule('0 */3 * * *', ...)

// Daily at midnight
cron.schedule('0 0 * * *', ...)
```

## Dependencies
- `node-cron` - Cron job scheduling
- `contributionScheduler` - Handles contribution auto-debit logic
- `payoutScheduler` - Handles payout processing logic

## Related Documentation
- See `services/contributionScheduler.js` for contribution logic
- See `services/payoutScheduler.js` for payout logic
- See project docs for full cron job implementation guide
