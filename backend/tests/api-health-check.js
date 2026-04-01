/**
 * CircSave API Health Check Script
 * Tests server connectivity, database connection, and API endpoint availability
 */

import axios from 'axios';
import chalk from 'chalk';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Test results tracker
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

// Helper function to log test results
function logTest(name, status, message, responseTime = null) {
    const test = { name, status, message, responseTime };
    results.tests.push(test);

    const statusSymbol = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    const statusColor = status === 'PASS' ? chalk.green : status === 'FAIL' ? chalk.red : chalk.yellow;
    const timeInfo = responseTime ? ` (${responseTime}ms)` : '';

    console.log(`${statusColor(statusSymbol)} ${name}${timeInfo}`);
    if (message) {
        console.log(`  ${chalk.gray(message)}`);
    }

    if (status === 'PASS') results.passed++;
    else if (status === 'FAIL') results.failed++;
    else results.warnings++;
}

// Test server connectivity
async function testServerConnectivity() {
    console.log(chalk.bold('\n📡 Testing Server Connectivity...\n'));

    try {
        const startTime = Date.now();
        const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.success) {
            logTest('Server Health Check', 'PASS', 'Server is running and healthy', responseTime);

            // Check response time
            if (responseTime > 1000) {
                logTest('Response Time Check', 'WARN', `Slow response: ${responseTime}ms (expected < 1000ms)`);
            } else {
                logTest('Response Time Check', 'PASS', `Good response time: ${responseTime}ms`);
            }

            return true;
        } else {
            logTest('Server Health Check', 'FAIL', 'Server returned unexpected response');
            return false;
        }
    } catch (error) {
        logTest('Server Health Check', 'FAIL', `Cannot connect to server: ${error.message}`);
        return false;
    }
}

// Test authentication endpoints
async function testAuthEndpoints() {
    console.log(chalk.bold('\n🔐 Testing Authentication Endpoints...\n'));

    const testEmail = `test_${Date.now()}@circsave.test`;
    const testPassword = 'TestPassword123!';
    let authToken = null;

    // Test signup endpoint
    try {
        const startTime = Date.now();
        const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
            fullName: 'Test User',
            email: testEmail,
            password: testPassword,
            phoneNumber: '1234567890',
            address: 'Test Address'
        }, { timeout: 5000 });
        const responseTime = Date.now() - startTime;

        if (response.status === 201 && response.data.success && response.data.data.token) {
            logTest('POST /api/auth/signup', 'PASS', 'User registration successful', responseTime);
            authToken = response.data.data.token;
        } else {
            logTest('POST /api/auth/signup', 'FAIL', 'Signup returned unexpected response');
        }
    } catch (error) {
        logTest('POST /api/auth/signup', 'FAIL', `Signup failed: ${error.response?.data?.message || error.message}`);
    }

    // Test login endpoint
    try {
        const startTime = Date.now();
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: testEmail,
            password: testPassword
        }, { timeout: 5000 });
        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.success && response.data.data.token) {
            logTest('POST /api/auth/login', 'PASS', 'User login successful', responseTime);
            authToken = response.data.data.token;
        } else {
            logTest('POST /api/auth/login', 'FAIL', 'Login returned unexpected response');
        }
    } catch (error) {
        logTest('POST /api/auth/login', 'FAIL', `Login failed: ${error.response?.data?.message || error.message}`);
    }

    // Test protected endpoint (get profile)
    if (authToken) {
        try {
            const startTime = Date.now();
            const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data.success) {
                logTest('GET /api/auth/me', 'PASS', 'Protected route accessible with valid token', responseTime);
            } else {
                logTest('GET /api/auth/me', 'FAIL', 'Profile endpoint returned unexpected response');
            }
        } catch (error) {
            logTest('GET /api/auth/me', 'FAIL', `Profile fetch failed: ${error.response?.data?.message || error.message}`);
        }

        // Test profile update
        try {
            const startTime = Date.now();
            const response = await axios.put(`${API_BASE_URL}/auth/profile`, {
                fullName: 'Updated Test User',
                phoneNumber: '0987654321'
            }, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data.success) {
                logTest('PUT /api/auth/profile', 'PASS', 'Profile update successful', responseTime);
            } else {
                logTest('PUT /api/auth/profile', 'FAIL', 'Profile update returned unexpected response');
            }
        } catch (error) {
            logTest('PUT /api/auth/profile', 'FAIL', `Profile update failed: ${error.response?.data?.message || error.message}`);
        }
    } else {
        logTest('Protected Endpoints', 'FAIL', 'Skipped - no auth token available');
    }

    return authToken;
}

// Test group endpoints
async function testGroupEndpoints(authToken) {
    console.log(chalk.bold('\n👥 Testing Group Management Endpoints...\n'));

    if (!authToken) {
        logTest('Group Endpoints', 'FAIL', 'Skipped - no auth token available');
        return null;
    }

    let groupId = null;

    // Test create group
    try {
        const startTime = Date.now();
        const response = await axios.post(`${API_BASE_URL}/groups`, {
            name: `Test Group ${Date.now()}`,
            description: 'Test group for health check',
            contributionAmount: 5000,
            contributionFrequency: 'weekly',
            maxMembers: 10,
            duration: 3
        }, {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 5000
        });
        const responseTime = Date.now() - startTime;

        if (response.status === 201 && response.data.success && response.data.data.group) {
            logTest('POST /api/groups', 'PASS', 'Group creation successful', responseTime);
            groupId = response.data.data.group._id;
        } else {
            logTest('POST /api/groups', 'FAIL', 'Group creation returned unexpected response');
        }
    } catch (error) {
        logTest('POST /api/groups', 'FAIL', `Group creation failed: ${error.response?.data?.message || error.message}`);
    }

    // Test get my groups
    try {
        const startTime = Date.now();
        const response = await axios.get(`${API_BASE_URL}/groups`, {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 5000
        });
        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.success) {
            logTest('GET /api/groups', 'PASS', `Retrieved ${response.data.data.groups?.length || 0} groups`, responseTime);
        } else {
            logTest('GET /api/groups', 'FAIL', 'Get groups returned unexpected response');
        }
    } catch (error) {
        logTest('GET /api/groups', 'FAIL', `Get groups failed: ${error.response?.data?.message || error.message}`);
    }

    // Test get specific group
    if (groupId) {
        try {
            const startTime = Date.now();
            const response = await axios.get(`${API_BASE_URL}/groups/${groupId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data.success) {
                logTest('GET /api/groups/:id', 'PASS', 'Group details retrieved successfully', responseTime);
            } else {
                logTest('GET /api/groups/:id', 'FAIL', 'Get group details returned unexpected response');
            }
        } catch (error) {
            logTest('GET /api/groups/:id', 'FAIL', `Get group details failed: ${error.response?.data?.message || error.message}`);
        }
    }

    return groupId;
}

// Test contribution endpoints
async function testContributionEndpoints(authToken, groupId) {
    console.log(chalk.bold('\n💰 Testing Contribution Endpoints...\n'));

    if (!authToken) {
        logTest('Contribution Endpoints', 'FAIL', 'Skipped - no auth token available');
        return;
    }

    // Test get my contributions
    try {
        const startTime = Date.now();
        const response = await axios.get(`${API_BASE_URL}/contributions/my`, {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 5000
        });
        const responseTime = Date.now() - startTime;

        if (response.status === 200 && response.data.success) {
            logTest('GET /api/contributions/my', 'PASS', `Retrieved ${response.data.data.contributions?.length || 0} contributions`, responseTime);
        } else {
            logTest('GET /api/contributions/my', 'FAIL', 'Get contributions returned unexpected response');
        }
    } catch (error) {
        logTest('GET /api/contributions/my', 'FAIL', `Get contributions failed: ${error.response?.data?.message || error.message}`);
    }

    // Test get group contributions
    if (groupId) {
        try {
            const startTime = Date.now();
            const response = await axios.get(`${API_BASE_URL}/contributions/group/${groupId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data.success) {
                logTest('GET /api/contributions/group/:groupId', 'PASS', 'Group contributions retrieved', responseTime);
            } else {
                logTest('GET /api/contributions/group/:groupId', 'FAIL', 'Get group contributions returned unexpected response');
            }
        } catch (error) {
            logTest('GET /api/contributions/group/:groupId', 'FAIL', `Get group contributions failed: ${error.response?.data?.message || error.message}`);
        }

        // Test get contribution stats
        try {
            const startTime = Date.now();
            const response = await axios.get(`${API_BASE_URL}/contributions/stats/${groupId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data.success) {
                logTest('GET /api/contributions/stats/:groupId', 'PASS', 'Contribution stats retrieved', responseTime);
            } else {
                logTest('GET /api/contributions/stats/:groupId', 'FAIL', 'Get stats returned unexpected response');
            }
        } catch (error) {
            logTest('GET /api/contributions/stats/:groupId', 'FAIL', `Get stats failed: ${error.response?.data?.message || error.message}`);
        }
    }
}

// Print summary
function printSummary() {
    console.log(chalk.bold('\n' + '='.repeat(60)));
    console.log(chalk.bold('📊 Test Summary\n'));

    const total = results.passed + results.failed + results.warnings;
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

    console.log(`Total Tests: ${total}`);
    console.log(chalk.green(`✓ Passed: ${results.passed}`));
    console.log(chalk.red(`✗ Failed: ${results.failed}`));
    console.log(chalk.yellow(`⚠ Warnings: ${results.warnings}`));
    console.log(`\nPass Rate: ${passRate}%`);

    console.log(chalk.bold('\n' + '='.repeat(60)));

    if (results.failed > 0) {
        console.log(chalk.red('\n❌ Some tests failed. Please review the errors above.'));
        process.exit(1);
    } else if (results.warnings > 0) {
        console.log(chalk.yellow('\n⚠️  All tests passed with warnings.'));
    } else {
        console.log(chalk.green('\n✅ All tests passed successfully!'));
    }
}

// Main test runner
async function runTests() {
    console.log(chalk.bold.cyan('\n🧪 CircSave API Health Check\n'));
    console.log(chalk.gray(`Testing API at: ${API_BASE_URL}\n`));

    try {
        // Test server connectivity
        const serverOnline = await testServerConnectivity();

        if (!serverOnline) {
            console.log(chalk.red('\n❌ Server is not accessible. Please ensure the backend is running.'));
            console.log(chalk.gray('   Start the server with: cd backend && npm run dev\n'));
            process.exit(1);
        }

        // Test authentication endpoints
        const authToken = await testAuthEndpoints();

        // Test group endpoints
        const groupId = await testGroupEndpoints(authToken);

        // Test contribution endpoints
        await testContributionEndpoints(authToken, groupId);

        // Print summary
        printSummary();

    } catch (error) {
        console.log(chalk.red(`\n❌ Unexpected error: ${error.message}`));
        process.exit(1);
    }
}

// Run tests
runTests();
