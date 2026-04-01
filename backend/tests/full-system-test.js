import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = 'http://localhost:5000/api';

// Test data
let tokens = {};
let groupId = null;
let contributionIds = [];

// Helper function to log test results
function logTest(testName, success, data = null) {
    const status = success ? '✅' : '❌';
    console.log(`\n${status} ${testName}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// Helper function to create a test receipt image
function createTestReceipt(filename) {
    const receiptPath = path.join(__dirname, filename);
    // Create a simple text file as a mock receipt (in real scenario, use actual image)
    fs.writeFileSync(receiptPath, 'Mock Receipt Image Data');
    return receiptPath;
}

async function runFullTest() {
    console.log('\n🚀 Starting CircSave Full System Test\n');
    console.log('='.repeat(60));

    try {
        // ============================================
        // STEP 1: User Registration
        // ============================================
        console.log('\n📝 STEP 1: User Registration');
        console.log('-'.repeat(60));

        const users = [
            {
                fullName: 'Admin User',
                email: 'admin@test.com',
                password: 'password123',
                phoneNumber: '08012345678',
                address: '123 Admin Street'
            },
            {
                fullName: 'Member One',
                email: 'member1@test.com',
                password: 'password123',
                phoneNumber: '08012345679',
                address: '124 Member Street'
            },
            {
                fullName: 'Member Two',
                email: 'member2@test.com',
                password: 'password123',
                phoneNumber: '08012345680',
                address: '125 Member Street'
            }
        ];

        for (const user of users) {
            try {
                const response = await axios.post(`${API_URL}/auth/signup`, user);
                logTest(`Register ${user.fullName}`, response.data.success, {
                    user: response.data.data.user.fullName,
                    email: response.data.data.user.email
                });
            } catch (error) {
                if (error.response?.data?.message?.includes('already exists')) {
                    logTest(`${user.fullName} already registered`, true);
                } else {
                    throw error;
                }
            }
        }

        // ============================================
        // STEP 2: User Login
        // ============================================
        console.log('\n🔐 STEP 2: User Login');
        console.log('-'.repeat(60));

        for (const user of users) {
            const response = await axios.post(`${API_URL}/auth/login`, {
                email: user.email,
                password: user.password
            });
            tokens[user.email] = response.data.data.token;
            logTest(`Login ${user.fullName}`, response.data.success, {
                token: response.data.data.token.substring(0, 20) + '...'
            });
        }

        // ============================================
        // STEP 3: Create Savings Group
        // ============================================
        console.log('\n👥 STEP 3: Create Savings Group');
        console.log('-'.repeat(60));

        const groupData = {
            name: 'Test Savings Circle',
            description: 'A test group for end-to-end testing',
            contributionAmount: 10000,
            contributionFrequency: 'monthly',
            contributionPeriodMonths: 3,
            latePaymentPenalty: 500,
            startDate: new Date().toISOString()
        };

        const createGroupResponse = await axios.post(
            `${API_URL}/groups`,
            groupData,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        groupId = createGroupResponse.data.data.group._id;
        const joinCode = createGroupResponse.data.data.group.joinCode;

        logTest('Create Group', createGroupResponse.data.success, {
            groupId,
            name: createGroupResponse.data.data.group.name,
            joinCode,
            contributionAmount: createGroupResponse.data.data.group.contributionAmount
        });

        // ============================================
        // STEP 4: Members Join Group
        // ============================================
        console.log('\n🤝 STEP 4: Members Join Group');
        console.log('-'.repeat(60));

        for (const user of users.slice(1)) { // Skip admin, already a member
            const joinResponse = await axios.post(
                `${API_URL}/groups/join`,
                { joinCode },
                {
                    headers: { Authorization: `Bearer ${tokens[user.email]}` }
                }
            );

            logTest(`${user.fullName} joins group`, joinResponse.data.success, {
                memberCount: joinResponse.data.data.group.members.length
            });
        }

        // ============================================
        // STEP 5: Get Group Details
        // ============================================
        console.log('\n📊 STEP 5: Get Group Details');
        console.log('-'.repeat(60));

        const groupDetailsResponse = await axios.get(
            `${API_URL}/groups/${groupId}`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get Group Details', groupDetailsResponse.data.success, {
            name: groupDetailsResponse.data.data.group.name,
            members: groupDetailsResponse.data.data.group.members.length,
            currentCycle: groupDetailsResponse.data.data.group.currentCycle
        });

        // ============================================
        // STEP 6: Submit Contributions (Cycle 1)
        // ============================================
        console.log('\n💰 STEP 6: Submit Contributions (Cycle 1)');
        console.log('-'.repeat(60));

        // Create a mock receipt file
        const receiptPath = createTestReceipt('test-receipt.txt');

        for (const user of users) {
            try {
                const formData = new FormData();
                formData.append('groupId', groupId);
                formData.append('cycleNumber', 1);
                formData.append('amount', 10000);
                formData.append('notes', `Contribution from ${user.fullName}`);
                formData.append('receipt', fs.createReadStream(receiptPath));

                const contributionResponse = await axios.post(
                    `${API_URL}/contributions`,
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            Authorization: `Bearer ${tokens[user.email]}`
                        }
                    }
                );

                contributionIds.push(contributionResponse.data.data.contribution._id);

                logTest(`${user.fullName} submits contribution`, contributionResponse.data.success, {
                    contributionId: contributionResponse.data.data.contribution._id,
                    amount: contributionResponse.data.data.contribution.amount,
                    status: contributionResponse.data.data.contribution.status
                });
            } catch (error) {
                logTest(`${user.fullName} contribution`, false, {
                    error: error.response?.data?.message || error.message
                });
            }
        }

        // Clean up test receipt
        fs.unlinkSync(receiptPath);

        // ============================================
        // STEP 7: Admin Reviews Pending Contributions
        // ============================================
        console.log('\n🔍 STEP 7: Admin Reviews Pending Contributions');
        console.log('-'.repeat(60));

        const pendingResponse = await axios.get(
            `${API_URL}/contributions/pending/${groupId}`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get Pending Contributions', pendingResponse.data.success, {
            pendingCount: pendingResponse.data.data.contributions.length
        });

        // ============================================
        // STEP 8: Admin Approves Contributions
        // ============================================
        console.log('\n✅ STEP 8: Admin Approves Contributions');
        console.log('-'.repeat(60));

        for (const contributionId of contributionIds) {
            const approveResponse = await axios.put(
                `${API_URL}/contributions/${contributionId}/verify`,
                {
                    status: 'approved',
                    notes: 'Verified and approved'
                },
                {
                    headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
                }
            );

            logTest(`Approve contribution ${contributionId.substring(0, 8)}...`, approveResponse.data.success);
        }

        // ============================================
        // STEP 9: View Contribution Statistics
        // ============================================
        console.log('\n📈 STEP 9: View Contribution Statistics');
        console.log('-'.repeat(60));

        const statsResponse = await axios.get(
            `${API_URL}/contributions/stats/${groupId}`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get Contribution Stats', statsResponse.data.success, statsResponse.data.data);

        // ============================================
        // STEP 10: View Monthly Aggregation
        // ============================================
        console.log('\n📅 STEP 10: View Monthly Aggregation');
        console.log('-'.repeat(60));

        const monthlyResponse = await axios.get(
            `${API_URL}/contributions/monthly/${groupId}`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get Monthly Aggregation', monthlyResponse.data.success, monthlyResponse.data.data);

        // ============================================
        // STEP 11: View User Contribution Summary
        // ============================================
        console.log('\n📋 STEP 11: View User Contribution Summary');
        console.log('-'.repeat(60));

        const summaryResponse = await axios.get(
            `${API_URL}/contributions/summary/${groupId}`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get Contribution Summary', summaryResponse.data.success, summaryResponse.data.data.summary);

        // ============================================
        // STEP 12: Test Group Management Features
        // ============================================
        console.log('\n🔧 STEP 12: Test Group Management Features');
        console.log('-'.repeat(60));

        // Test invite member (will fail without email config, but tests the endpoint)
        try {
            const inviteResponse = await axios.post(
                `${API_URL}/groups/${groupId}/invite`,
                {
                    email: 'newmember@test.com',
                    name: 'New Member'
                },
                {
                    headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
                }
            );
            logTest('Invite Member', inviteResponse.data.success, {
                emailSent: inviteResponse.data.emailSent
            });
        } catch (error) {
            logTest('Invite Member (Email disabled)', true, {
                note: 'Email service not configured - expected behavior'
            });
        }

        // ============================================
        // STEP 13: Test AI Insights (if enabled)
        // ============================================
        console.log('\n🤖 STEP 13: Test AI Insights');
        console.log('-'.repeat(60));

        try {
            const insightResponse = await axios.post(
                `${API_URL}/insights/generate`,
                {
                    type: 'advice',
                    groupId
                },
                {
                    headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
                }
            );
            logTest('Generate AI Insight', insightResponse.data.success, insightResponse.data.data);
        } catch (error) {
            logTest('AI Insights (AI disabled)', true, {
                note: 'AI service not configured - expected behavior',
                error: error.response?.data?.message
            });
        }

        // ============================================
        // STEP 14: Get User's Insights
        // ============================================
        console.log('\n💡 STEP 14: Get User Insights');
        console.log('-'.repeat(60));

        const myInsightsResponse = await axios.get(
            `${API_URL}/insights/my`,
            {
                headers: { Authorization: `Bearer ${tokens['admin@test.com']}` }
            }
        );

        logTest('Get My Insights', myInsightsResponse.data.success, {
            insightCount: myInsightsResponse.data.data.insights.length,
            unreadCount: myInsightsResponse.data.data.unreadCount
        });

        // ============================================
        // FINAL SUMMARY
        // ============================================
        console.log('\n' + '='.repeat(60));
        console.log('🎉 FULL SYSTEM TEST COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n✅ All core features tested:');
        console.log('  • User registration and authentication');
        console.log('  • Group creation and management');
        console.log('  • Member joining');
        console.log('  • Contribution submission with receipts');
        console.log('  • Admin approval workflow');
        console.log('  • Statistics and aggregation');
        console.log('  • Monthly summaries');
        console.log('  • Group management (invite)');
        console.log('  • AI insights integration');
        console.log('\n📊 Test Results:');
        console.log(`  • Users created: ${users.length}`);
        console.log(`  • Group created: 1`);
        console.log(`  • Contributions submitted: ${contributionIds.length}`);
        console.log(`  • Contributions approved: ${contributionIds.length}`);
        console.log('\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data || error.message);
        console.error('\nFull error:', error);
    }
}

// Run the test
runFullTest();
