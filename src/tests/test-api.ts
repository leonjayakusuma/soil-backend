import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || '';

interface TestResult {
    name: string;
    method: string;
    endpoint: string;
    status: number;
    success: boolean;
    error?: string;
    data?: any;
}

const results: TestResult[] = [];

// Helper function to make API requests
async function makeRequest(
    method: string,
    endpoint: string,
    body?: any,
    contentType: 'json' | 'form' = 'json'
): Promise<TestResult> {
    const url = `${BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
        'x-api-key': API_KEY,
    };

    if (contentType === 'json') {
        headers['Content-Type'] = 'application/json';
    } else {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const options: RequestInit = {
        method,
        headers,
    };

    if (body) {
        if (contentType === 'json') {
            options.body = JSON.stringify(body);
        } else {
            // Convert object to URL-encoded string
            const formBody = new URLSearchParams();
            Object.entries(body).forEach(([key, value]) => {
                formBody.append(key, String(value));
            });
            options.body = formBody.toString();
        }
    }

    try {
        const response = await fetch(url, options);
        const data = (await response.json().catch(() => ({}))) as Record<string, any>;
        
        return {
            name: `${method} ${endpoint}`,
            method,
            endpoint,
            status: response.status,
            success: response.ok,
            error: response.ok ? undefined : (data.error || data.message || 'Unknown error') as string | undefined,
            data: response.ok ? data : undefined,
        };
    } catch (error: any) {
        let errorMessage = 'Network error';
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
            errorMessage = `Connection refused - Is the server running at ${BASE_URL}?`;
        } else if (error.message?.includes('fetch failed')) {
            errorMessage = `Connection failed - Server may not be running at ${BASE_URL}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return {
            name: `${method} ${endpoint}`,
            method,
            endpoint,
            status: 0,
            success: false,
            error: errorMessage,
        };
    }
}

// Test functions
async function testHealthCheck() {
    console.log('\n🔍 Testing Health Check...');
    const result = await makeRequest('GET', '/health');
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testSignup() {
    console.log('\n🔍 Testing Signup...');
    // Use last 6 digits of timestamp to keep name under 16 chars (testuser + 6 digits = 14 chars)
    const timestamp = Date.now().toString().slice(-6);
    const email = `test${timestamp}@example.com`;
    const name = `test${timestamp}`; // 4 chars + 6 digits = 10 chars (well under 16 limit)
    const password = 'TestPassword123!';
    
    const result = await makeRequest('POST', '/api/signup', {
        email,
        name,
        password,
    }, 'json');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    if (result.success) {
        console.log('   User created:', { email, name });
    }
    
    return { email, password, name };
}

async function testEmailAndNameExists(email: string, name: string) {
    console.log('\n🔍 Testing Email and Name Exists...');
    const result = await makeRequest('POST', '/api/emailAndNameExists', {
        email,
        name,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    return result;
}

async function testLogin(email: string, password: string) {
    console.log('\n🔍 Testing Login...');
    const result = await makeRequest('POST', '/api/login', {
        email,
        password,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    
    if (result.success && result.data) {
        console.log('   Login successful!');
        return {
            accessToken: result.data.data?.accessToken,
            refreshToken: result.data.data?.refreshToken,
            userId: result.data.data?.id,
        };
    }
    
    return null;
}

async function testGetAllItems() {
    console.log('\n🔍 Testing Get All Items...');
    const result = await makeRequest('GET', '/api/allItems');
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    if (result.success && result.data) {
        const items = Array.isArray(result.data) ? result.data : result.data.data || [];
        console.log(`   Found ${items.length} items`);
        return items;
    }
    return [];
}

async function testGetItem(itemId: number) {
    console.log('\n🔍 Testing Get Item...');
    const result = await makeRequest('GET', `/api/item?itemId=${itemId}`);
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    return result.data;
}

async function testGetAllRecipes() {
    console.log('\n🔍 Testing Get All Recipes...');
    const result = await makeRequest('GET', '/api/recipes');
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    if (result.success && result.data) {
        const recipes = Array.isArray(result.data) ? result.data : result.data.data || [];
        console.log(`   Found ${recipes.length} recipes`);
    }
}

async function testGetSpecialItems() {
    console.log('\n🔍 Testing Get Special Items...');
    const result = await makeRequest('GET', '/api/specials');
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetUserPageInfo(userId: number) {
    console.log('\n🔍 Testing Get User Page Info...');
    const result = await makeRequest('GET', `/api/userPageInfo?userId=${userId}`);
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetProfileInfo(accessToken: string) {
    console.log('\n🔍 Testing Get Profile Info...');
    const result = await makeRequest('POST', '/api/protected/profileInfo', {
        accessToken,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetPersonalInfo(accessToken: string) {
    console.log('\n🔍 Testing Get Personal Info...');
    const result = await makeRequest('POST', '/api/protected/personalInfo', {
        accessToken,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetCart(accessToken: string) {
    console.log('\n🔍 Testing Get Cart...');
    const result = await makeRequest('POST', '/api/protected/cart', {
        accessToken,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    return result.data;
}

async function testAddItemToCart(accessToken: string, itemId: number) {
    console.log('\n🔍 Testing Add Item to Cart...');
    const result = await makeRequest('POST', '/api/protected/addItemToCart', {
        accessToken,
        itemId,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testUpdateItemQuantity(accessToken: string, itemId: number, quantity: number) {
    console.log('\n🔍 Testing Update Item Quantity...');
    const result = await makeRequest('POST', '/api/protected/updateItemQuantityFromCart', {
        accessToken,
        itemId,
        quantity,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testDeleteItemFromCart(accessToken: string, itemId: number) {
    console.log('\n🔍 Testing Delete Item from Cart...');
    const result = await makeRequest('POST', '/api/protected/deleteItemFromCart', {
        accessToken,
        itemId,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetItemReviews(itemId: number) {
    console.log('\n🔍 Testing Get Item Reviews...');
    const result = await makeRequest('POST', '/api/itemReviews', {
        itemId,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testCreateReview(accessToken: string, itemId: number) {
    console.log('\n🔍 Testing Create Review...');
    const result = await makeRequest('POST', '/api/protected/createReview', {
        accessToken,
        itemId,
        rating: 4.5,
        reviewTxt: 'This is a test review created by the API test script.',
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    return result.data?.data?.id;
}

async function testGetUserReviews(userId: number) {
    console.log('\n🔍 Testing Get User Reviews...');
    const result = await makeRequest('GET', `/api/protected/reviews?userId=${userId}`);
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testUpdateBasicUserInfo(accessToken: string, newName: string, newEmail: string) {
    console.log('\n🔍 Testing Update Basic User Info...');
    const result = await makeRequest('POST', '/api/protected/updateBasicUserInfo', {
        accessToken,
        name: newName,
        email: newEmail,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
}

async function testGetNewAccessToken(accessToken: string, refreshToken: string) {
    console.log('\n🔍 Testing Get New Access Token...');
    const result = await makeRequest('POST', '/api/getNewAccessToken', {
        accessToken,
        refreshToken,
    }, 'form');
    
    results.push(result);
    console.log(result.success ? '✅' : '❌', result.name, `- Status: ${result.status}`);
    if (result.success && result.data) {
        return result.data.data?.accessToken;
    }
    return null;
}

// Check if server is reachable
async function checkServerConnection(): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        return response.ok;
    } catch (error: any) {
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting API Tests...');
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🔑 API Key: ${API_KEY ? 'Set' : 'NOT SET (tests may fail)'}`);
    
    // Check server connectivity first
    console.log('\n🔍 Checking server connectivity...');
    const serverReachable = await checkServerConnection();
    if (!serverReachable) {
        console.log('❌ Server is not reachable!');
        console.log(`   Please make sure the server is running at ${BASE_URL}`);
        console.log('   Start the server with: npm run dev');
        console.log('\n⚠️  Skipping all tests.');
        return;
    }
    console.log('✅ Server is reachable!\n');
    
    try {
        // Health check
        await testHealthCheck();
        
        // Auth tests
        const userCreds = await testSignup();
        if (!userCreds) {
            console.log('❌ Signup failed, skipping remaining tests');
            printSummary();
            return;
        }
        
        await testEmailAndNameExists(userCreds.email, userCreds.name);
        const tokens = await testLogin(userCreds.email, userCreds.password);
        
        if (!tokens || !tokens.accessToken) {
            console.log('❌ Login failed, skipping protected endpoint tests');
            printSummary();
            return;
        }
        
        // Public item tests
        const items = await testGetAllItems();
        await testGetAllRecipes();
        await testGetSpecialItems();
        
        if (items.length > 0) {
            const firstItem = items[0];
            const itemId = firstItem.id || firstItem.itemId || 1;
            await testGetItem(itemId);
            await testGetItemReviews(itemId);
        }
        
        if (tokens.userId) {
            await testGetUserPageInfo(tokens.userId);
        }
        
        // Protected endpoint tests
        await testGetProfileInfo(tokens.accessToken);
        await testGetPersonalInfo(tokens.accessToken);
        
        // Cart tests
        await testGetCart(tokens.accessToken);
        
        if (items.length > 0) {
            const firstItem = items[0];
            const itemId = firstItem.id || firstItem.itemId || 1;
            await testAddItemToCart(tokens.accessToken, itemId);
            await testGetCart(tokens.accessToken);
            await testUpdateItemQuantity(tokens.accessToken, itemId, 2);
            await testGetCart(tokens.accessToken);
            await testDeleteItemFromCart(tokens.accessToken, itemId);
            await testGetCart(tokens.accessToken);
            
            // Review tests
            await testCreateReview(tokens.accessToken, itemId);
            if (tokens.userId) {
                await testGetUserReviews(tokens.userId);
            }
        }
        
        // Token refresh test
        if (tokens.refreshToken) {
            await testGetNewAccessToken(tokens.accessToken, tokens.refreshToken);
        }
        
        // Update user info test
        // Use last 6 digits of timestamp to keep name under 16 chars
        const updateTimestamp = Date.now().toString().slice(-6);
        const newEmail = `updated${updateTimestamp}@example.com`;
        const newName = `upd${updateTimestamp}`; // 3 chars + 6 digits = 9 chars (well under 16 limit)
        await testUpdateBasicUserInfo(tokens.accessToken, newName, newEmail);
        
    } catch (error: any) {
        console.error('❌ Test execution error:', error.message);
    }
    
    printSummary();
}

function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = total - passed;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        results
            .filter(r => !r.success)
            .forEach(r => {
                console.log(`  - ${r.name}`);
                console.log(`    Status: ${r.status}`);
                console.log(`    Error: ${r.error || 'Unknown'}`);
            });
    }
    
    console.log('\n' + '='.repeat(60));
}

// Run tests
runTests().catch(console.error);

