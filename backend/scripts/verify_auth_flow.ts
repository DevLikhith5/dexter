import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/users';

async function verifyAuth() {
    const timestamp = Date.now();
    const testUser = {
        username: `testuser_${timestamp}`,
        email: `test_${timestamp}@example.com`,
        password: 'password123'
    };

    console.log('Starting Auth Verification...');
    console.log('Test User:', testUser);

    try {
        // 1. Register
        console.log('\n1. Testing Registration...');
        const registerRes = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        const registerData = await registerRes.json();
        console.log('Registration Status:', registerRes.status);
        console.log('Registration Response:', registerData);

        if (registerRes.status !== 201) {
            throw new Error(`Registration failed: ${JSON.stringify(registerData)}`);
        }

        // 2. Login
        console.log('\n2. Testing Login...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });

        const loginData = await loginRes.json();
        console.log('Login Status:', loginRes.status);
        console.log('Login Response:', loginData);

        if (loginRes.status !== 200) {
            throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        }
        //@ts-ignore
        if (loginData?.token) {
            console.log('\nSUCCESS: Auth flow verified! Token received.');
        } else {
            throw new Error('Token missing in login response');
        }

    } catch (error) {
        console.error('\nFAILURE: Verification failed:', error);
        process.exit(1);
    }
}

verifyAuth();
