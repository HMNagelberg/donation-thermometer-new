// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Store last valid values
let lastAmount = 0;
let lastDonorCount = 0;
let lastDonorNames = [];

// Function to fetch and process CSV data - simplified for reliability
function fetchDonationData() {
    console.log('Attempting to fetch donation data...');
    
    // Use simple fetch with basic URL (no fancy parameters)
    fetch(CSV_URL)
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
    })
    .then(csvData => {
        console.log('CSV data received, length:', csvData.length);
        
        if (!csvData || csvData.trim() === '') {
            console.error('Empty CSV data received');
            return;
        }
        
        // Basic CSV parsing
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        console.log('Rows found:', rows.length);
        
        if (rows.length <= 1) {
            console.error('No data rows found in CSV');
            return;
        }
        
        // Get headers
        const headers = rows[0].split(',');
        
        // Find column indices
        const amountIndex = findColumnIndex(headers, ['amount', 'payment']);
        const nameIndex = findColumnIndex(headers, ['name', 'donor']);
        
        console.log('Column indices - Amount:', amountIndex, 'Name:', nameIndex);
        
        if (amountIndex === -1) {
            console.error('Could not find amount column in CSV. Headers:', headers);
            return;
        }
        
        // Process data
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            
            // Process amount
            if (amountIndex !== -1 && columns.length > amountIndex) {
                const amountStr = columns[amountIndex].replace(/[^\d.]/g, '');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount)) {
                    totalAmount += amount;
                }
            }
            
            // Process donor name
            if (nameIndex !== -1 && columns.length > nameIndex) {
                const name = columns[nameIndex].trim();
                if (name) {
                    donorNames.push(name);
                }
            }
        }
        
        console.log('Processed data - Total:', totalAmount, 'Donors:', donorCount);
        
        // Only update if we have valid data
        if (totalAmount > 0) {
            lastAmount = totalAmount;
            lastDonorCount = donorCount;
            lastDonorNames = donorNames;
            
            // Update display
            updateDisplay(totalAmount, donorCount, donorNames);
        }
    })
    .catch(error => {
        console.error('Error fetching donation data:', error);
        // On error, use last valid values
        updateDisplay(lastAmount, lastDonorCount, lastDonorNames);
    });
}

// Simple helper to find column index
function findColumnIndex(headers, possibleNames) {
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();
        for (const name of possibleNames) {
            if (header.includes(name)) {
                return i;
            }
        }
    }
    return -1;
}

// Helper function to calculate percentage
function calculatePercentage(amount) {
    return Math.min((amount / GOAL_AMOUNT) * 100, 100);
}

// Helper function to format currency
function formatCurrency(amount) {
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });
}

// Helper function to update the display
function updateDisplay(amount, donorCount, donorNames) {
    // Calculate percentage
    const percentage = calculatePercentage(amount);
    
    // Update thermometer (simple, no animation)
    thermometerProgress.style.height = `${percentage}%`;
    
    // Update text
    currentAmountElement.textContent = `${formatCurrency(amount)} raised`;
    donorCountElement.textContent = `${donorCount} donations`;
    
    // Update donor list
    if (donorNames && donorNames.length > 0) {
        donorListElement.innerHTML = donorNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Create a simple debug display to show what's happening
function createDebugDisplay() {
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.top = '10px';
    debugDiv.style.right = '10px';
    debugDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
    debugDiv.style.color = 'white';
    debugDiv.style.padding = '10px';
    debugDiv.style.borderRadius = '5px';
    debugDiv.style.zIndex = '1000';
    debugDiv.style.fontSize = '12px';
    debugDiv.style.maxWidth = '400px';
    debugDiv.style.maxHeight = '300px';
    debugDiv.style.overflow = 'auto';
    debugDiv.id = 'debug-panel';
    
    // Add controls
    debugDiv.innerHTML = `
        <div><strong>Debug Panel</strong> <button id="hide-debug" style="float:right">Hide</button></div>
        <div id="csv-status">Testing CSV connection...</div>
        <div>
            <button id="test-connection">Test Connection</button>
            <button id="force-refresh">Force Refresh</button>
        </div>
        <div id="debug-log" style="margin-top:10px;font-family:monospace;"></div>
    `;
    
    document.body.appendChild(debugDiv);
    
    // Add event listeners
    document.getElementById('hide-debug').addEventListener('click', () => {
        debugDiv.style.display = 'none';
    });
    
    document.getElementById('test-connection').addEventListener('click', testCSVConnection);
    document.getElementById('force-refresh').addEventListener('click', fetchDonationData);
    
    // Test connection immediately
    testCSVConnection();
}

// Function to test CSV connection
function testCSVConnection() {
    const statusEl = document.getElementById('csv-status');
    const logEl = document.getElementById('debug-log');
    
    statusEl.innerHTML = 'Testing CSV connection...';
    
    fetch(CSV_URL, { method: 'HEAD' })
    .then(response => {
        if (response.ok) {
            statusEl.innerHTML = '<span style="color:green">✓ CSV accessible</span>';
            
            // Try to get contents
            return fetch(CSV_URL).then(r => r.text());
        } else {
            statusEl.innerHTML = `<span style="color:red">✗ CSV error: ${response.status}</span>`;
            throw new Error(`HTTP error: ${response.status}`);
        }
    })
    .then(text => {
        if (text && text.length > 0) {
            const rows = text.split('\n').filter(row => row.trim() !== '');
            logEl.innerHTML = `CSV data: ${rows.length} rows<br>First row: ${rows[0]}<br>${text.substr(0, 100)}...`;
        } else {
            logEl.innerHTML = 'CSV accessible but empty';
        }
    })
    .catch(error => {
        statusEl.innerHTML = `<span style="color:red">✗ CSV error: ${error.message}</span>`;
        logEl.innerHTML = `Error details: ${error.toString()}`;
    });
}

// Add global functions for debugging from console
window.testCSV = testCSVConnection;
window.forceRefresh = fetchDonationData;

// Create debug display (comment out for production)
createDebugDisplay();

// Start the application
console.log('Starting donation thermometer application...');
fetchDonationData();
setInterval(fetchDonationData, REFRESH_INTERVAL);
