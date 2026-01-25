/**
 * Test script to fetch credits using esprit-ts library
 * This helps understand the exact structure of the credits data
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EspritClient } = require('@lime1/esprit-ts');

const STUDENT_ID = '221JMT5326';
const PASSWORD = '14371739';

async function main() {
    console.log('='.repeat(60));
    console.log('ESPRIT Credits Test Script');
    console.log('='.repeat(60));
    
    const client = new EspritClient({ debug: true });
    
    console.log('\n📝 Logging in...');
    const loginResult = await client.login(STUDENT_ID, PASSWORD);
    
    if (!loginResult.success) {
        console.error('❌ Login failed:', loginResult.message);
        return;
    }
    
    console.log('✅ Login successful!\n');
    
    // Test 1: Get Student Info
    console.log('='.repeat(60));
    console.log('📋 STUDENT INFO');
    console.log('='.repeat(60));
    try {
        const studentInfo = await client.getStudentInfo();
        console.log('Student Info:', JSON.stringify(studentInfo, null, 2));
    } catch (e) {
        console.error('Error getting student info:', e);
    }
    
    // Test 2: Get Credits - THIS IS WHAT WE NEED TO UNDERSTAND
    console.log('\n' + '='.repeat(60));
    console.log('🎖️ CREDITS');
    console.log('='.repeat(60));
    try {
        const credits = await client.getCredits();
        console.log('Credits result type:', typeof credits);
        console.log('Credits is null?:', credits === null);
        console.log('Credits is array?:', Array.isArray(credits));
        
        if (credits && credits.length > 0) {
            console.log(`\n✅ Found ${credits.length} credit record(s):\n`);
            credits.forEach((credit, index) => {
                console.log(`--- Credit Record ${index + 1} ---`);
                console.log(JSON.stringify(credit, null, 2));
                console.log('Keys:', Object.keys(credit));
            });
        } else {
            console.log('❌ No credits found or credits is null');
            console.log('Raw value:', credits);
        }
    } catch (e) {
        console.error('❌ Error getting credits:', e);
    }
    
    // Test 3: Get Regular Grades (for comparison)
    console.log('\n' + '='.repeat(60));
    console.log('📊 REGULAR GRADES (for comparison)');
    console.log('='.repeat(60));
    try {
        const grades = await client.getRegularGrades();
        if (grades && grades.length > 0) {
            console.log('Headers:', grades[0]);
            console.log(`Found ${grades.length - 1} grade rows`);
        } else {
            console.log('No grades found');
        }
    } catch (e) {
        console.error('Error getting grades:', e);
    }
    
    // Test 4: Get Ranking (might have credit info)
    console.log('\n' + '='.repeat(60));
    console.log('📈 RANKING');
    console.log('='.repeat(60));
    try {
        const ranking = await client.getRanking();
        if (ranking && ranking.length > 0) {
            console.log(`Found ${ranking.length} ranking record(s):`);
            ranking.forEach((entry, index) => {
                console.log(`--- Ranking ${index + 1} ---`);
                console.log(JSON.stringify(entry, null, 2));
            });
        } else {
            console.log('No ranking data found');
        }
    } catch (e) {
        console.error('Error getting ranking:', e);
    }
    
    // Logout
    console.log('\n' + '='.repeat(60));
    await client.logout();
    console.log('✅ Logged out successfully');
    console.log('='.repeat(60));
}

main().catch(console.error);
