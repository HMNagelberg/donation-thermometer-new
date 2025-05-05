// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Function to fetch and process CSV data
function fetchDonationData() {
    // Simple fetch with timestamp to avoid caching
    const timestamp = new Date().getTime();
    fetch(`${CSV_URL}?t=${timestamp}`)
        .then(response => response.text())
        .then(csvData => {
            if (!csvData || csvData.trim() === '') {
                console.error('Empty CSV data received');
                return;
            }
            
            // Parse CSV data
            const rows = csvData.split('\n').filter(row => row.trim() !== '');
            
            if (rows.length <= 1) {
                console.error('No data rows found in CSV');
                return;
            }
            
            // Get headers
            const headers = rows[0].split(',');
            
            // Find amount and name columns
            const amountIndex = findColumn(headers, ['amount', 'payment', 'donation']);
            const nameIndex = findColumn(headers, ['name', 'donor']);
            
            if (amountIndex === -1) {
                console.error('Could not find amount column in CSV');
                return;
            }
            
            // Process data rows
            let totalAmount = 0;
            const donorCount = rows.length - 1;
            const donorNames = [];
            
            for (let i = 1; i < rows.length; i++) {
                const columns = rows[i].split(',');
                
                // Get amount
                if (amountIndex !== -1 && columns.length > amountIndex) {
                    const amountStr = columns[amountIndex].replace(/[^\d.]/g, '');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount)) {
                        totalAmount += amount;
                    }
                }
                
                // Get name
                if (nameIndex !== -1 && columns.length > nameIndex) {
                    const name = columns[nameIndex].trim();
                    if (name) {
                        donorNames.push(name);
                    }
                }
            }
            
            // Update the display
            updateDisplay(totalAmount, donorCount, donorNames);
        })
        .catch(error => {
            console.error('Error fetching CSV data:', error);
        });
}

// Helper function to find column index
function findColumn(headers, possibleNames) {
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

// Update the display
function updateDisplay(amount, donorCount, donorNames) {
    // Calculate percentage
    const percentage = calculatePercentage(amount);
    
    // Update thermometer
    thermometerProgress.style.height = `${percentage}%`;
    
    // Update text
    currentAmountElement.textContent = `${formatCurrency(amount)} raised`;
    donorCountElement.textContent = `${donorCount} donations`;
    
    // Update donor list
    if (donorNames.length > 0) {
        donorListElement.innerHTML = donorNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);
