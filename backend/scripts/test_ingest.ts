import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';

async function verifyIngest() {
    const timestamp = Date.now();
    const testUser = {
        username: `testuser_${timestamp}`,
        email: `test_${timestamp}@example.com`,
        password: 'password123'
    };

    try {
        // Register & Login to get token
        await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        const loginRes = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email, password: testUser.password })
        });
        const loginData = await loginRes.json();
        //@ts-ignore
        const token = loginData.token;

        if (!token) throw new Error('No token');

        console.log('Got token, hitting ingest...');

        // Hit ingest
        const ingestRes = await fetch(`${API_URL}/graph-rag/ingest`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                inputType: 'text',
                value: 'This is a very long test document. '.repeat(50)
            })
        });

        const ingestData = await ingestRes.json();
        console.log('Ingest Status:', ingestRes.status);
        console.log('Ingest Response:', ingestData);
        //@ts-ignore

        if (ingestData.data?.graph_id) {
            //@ts-ignore
            const generateRes = await fetch(`${API_URL}/graph-rag/generate/${ingestData.data.graph_id}?count=2`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Generate Status:', generateRes.status);
            console.log('Generate Response:', await generateRes.json());
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

verifyIngest();
