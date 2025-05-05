// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 3000; // 3 seconds for faster updates
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Use PapaParse for more reliable CSV parsing
// We'll need to add this library to your HTML

// Function to fetch and process CSV data
async function fetchDonationData() {
    try {
        // Add cache-busting parameter with timestamp
        const cacheBuster = new Date().getTime();
        const response = await fetch(`${CSV_URL}&cacheBuster=${cacheBuster}`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Parse CSV with PapaParse
        Papa.parse(csvData, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: function(results) {
                processData(results.data);
            },
            error: function(error) {
                console.error('CSV parsing error:', error);
            }
        });
    } catch (error) {
        console.error('Error fetching donation data:', error);
    }
}

// Process the parsed data
function processData(data) {
    if (!data || data.length === 0) {
        console.error('No data in CSV');
        return;
    }
    
    console.log('CSV data received:', data);
    
    // Find amount and name columns (case insensitive search)
    const columns = Object.keys(data[0]);
    
    const amountColumn = columns.find(col => 
        col.toLowerCase().includes('amount') || 
        col.toLowerCase().includes('payment') ||
        col.toLowerCase().includes('donation')
    );
    
    const nameColumn = columns.find(col => 
        col.toLowerCase().includes('name') || 
        col.toLowerCase().includes('donor')
    );
    
    if (!amountColumn) {
        console.error('Could not find amount column in CSV');
        return;
    }
    
    // Calculate total amount
    let totalAmount = 0;
    const donorCount = data.length;
    const donorNames = [];
    
    data.forEach(row => {
        // Process amount
        let amount = 0;
        if (row[amountColumn] !== undefined) {
            // Handle different data types
            if (typeof row[amountColumn] === 'number') {
                amount = row[amountColumn];
            } else if (typeof row[amountColumn] === 'string') {
                // Remove any non-numeric characters except decimal point
                const amountStr = row[amountColumn].replace(/[^\d.]/g, '');
                amount = parseFloat(amountStr);
            }
            
            if (!isNaN(amount)) {
                totalAmount += amount;
            }
        }
        
        // Process donor name
        if (nameColumn && row[nameColumn]) {
            const name = String(row[nameColumn]).trim();
            if (name) {
                donorNames.push(name);
            }
        }
    });
    
    // Update display
    updateDisplay(totalAmount, donorCount, donorNames);
    
    console.log(`Data refreshed. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Percentage: ${calculatePercentage(totalAmount).toFixed(2)}%`);
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
    
    // Update thermometer with animation
    const currentHeight = parseFloat(thermometerProgress.style.height) || 0;
    if (percentage > currentHeight) {
        thermometerProgress.classList.add('pulse');
        setTimeout(() => {
            thermometerProgress.classList.remove('pulse');
        }, 1000);
    }
    
    // Update thermometer height
    thermometerProgress.style.height = `${percentage}%`;
    
    // Update text with animation if values changed
    const currentAmountText = `${formatCurrency(amount)} raised`;
    if (currentAmountElement.textContent !== currentAmountText) {
        currentAmountElement.classList.add('pulse');
        currentAmountElement.textContent = currentAmountText;
        setTimeout(() => {
            currentAmountElement.classList.remove('pulse');
        }, 1000);
    }
    
    donorCountElement.textContent = `${donorCount} donation${donorCount !== 1 ? 's' : ''}`;
    
    // Update donor list
    if (donorNames && donorNames.length > 0) {
        donorListElement.innerHTML = donorNames.join(', ');
    } else {
        donorListElement.textContent = 'Be the first to donate!';
    }
}

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);
