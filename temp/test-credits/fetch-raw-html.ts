/**
 * Fetch raw HTML from credits page to understand the structure
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EspritClient } = require('@lime1/esprit-ts');

const STUDENT_ID = '221JMT5326';
const PASSWORD = '14371739';

async function main() {
    const axios = require('axios');
    const { wrapper } = require('axios-cookiejar-support');
    const { CookieJar } = require('tough-cookie');
    
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));
    
    const espritClient = new EspritClient({ debug: true });
    
    console.log('Logging in...');
    const loginResult = await espritClient.login(STUDENT_ID, PASSWORD);
    
    if (!loginResult.success) {
        console.error('Login failed:', loginResult.message);
        return;
    }
    
    console.log('Login successful!');
    
    // Get cookies from esprit client
    const cookies = await espritClient.getCookies();
    console.log('Cookies:', cookies);
    
    // Store cookies in our jar
    for (const cookie of cookies) {
        await jar.setCookie(`${cookie.name}=${cookie.value}`, 'https://esprit-tn.com/');
    }
    
    // Fetch credits page
    console.log('\nFetching credits page...');
    const creditsUrl = 'https://esprit-tn.com/ESPOnline/Etudiants/Historique_Cr%C3%A9dit.aspx';
    
    const response = await client.get(creditsUrl);
    const html = response.data;
    
    console.log('\n=== RAW HTML (first 5000 chars) ===');
    console.log(html.substring(0, 5000));
    
    console.log('\n=== SEARCHING FOR TABLE ===');
    
    // Look for GridView1
    if (html.includes('ContentPlaceHolder1_GridView1')) {
        console.log('✅ Found ContentPlaceHolder1_GridView1');
    } else {
        console.log('❌ ContentPlaceHolder1_GridView1 NOT found');
    }
    
    // Extract table headers
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    const headers = [];
    let match;
    while ((match = thRegex.exec(html)) !== null) {
        const header = match[1].replace(/<[^>]+>/g, '').trim();
        if (header) headers.push(header);
    }
    console.log('\nAll table headers found:', headers);
    
    // Look for specific credit-related text
    const creditTerms = ['Année', 'enseignement', 'Module', 'moy', 'Crédit', 'acquis'];
    console.log('\nSearching for credit-related terms:');
    for (const term of creditTerms) {
        console.log(`  ${term}: ${html.includes(term) ? '✅ Found' : '❌ Not found'}`);
    }
    
    await espritClient.logout();
    console.log('\nLogged out');
}

main().catch(console.error);
