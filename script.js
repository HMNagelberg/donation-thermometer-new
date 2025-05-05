// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 3000; // 3 seconds for updates

// Use a CORS proxy to access the Google Sheet
// This is the critical change to bypass the CORS restriction
const CORS_PROXY = 'https://corsproxy.io/?';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';
const CSV_URL = CORS_PROXY + encodeURIComponent(SHEET_URL);

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Store previous valid values
let lastValidTotal = 0;
let lastValidDonorCount = 0;
let lastValidDonorNames = [];
let consecutiveErrorCount = 0;
const MAX_ERRORS = 3;

// Function to fetch and process CSV data
async function fetchDonationData() {
    try {
        console.log("Attempting to fetch donation data via CORS proxy");
        
        // Add cache-busting parameters
        const timestamp = new Date().getTime();
        const randomParam = Math.floor(Math.random() * 1000000);
        const noCacheUrl = `${CSV_URL}&_=${timestamp}&r=${randomParam}`;
        
        const response = await fetch(noCacheUrl, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            // Add a timeout to prevent hanging requests
            signal: AbortSignal.timeout(7000) // 7 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Validate that we have actual CSV data
        if (!csvData || csvData.trim() === '') {
            throw new Error('Empty CSV data received');
        }
        
        // Parse CSV data
        const rows = csvData.split('\n')
            .filter(row => row.trim() !== '')
            .map(row => row.split(',').map(cell => cell.trim()));
        
        if (rows.length === 0) {
            throw new Error('No rows found in CSV');
        }
        
        const headers = rows[0];
        
        // Find column indices
        let amountIndex = headers.findIndex(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment') ||
            header.toLowerCase().includes('donation')
        );
        
        if (amountIndex === -1) {
            amountIndex = 1; // Fallback to column index 1
        }
        
        let nameIndex = headers.findIndex(header => 
            header.toLowerCase().includes('name') || 
            header.toLowerCase().includes('donor') ||
            header.toLowerCase().includes('person')
        );
        
        if (nameIndex === -1) {
            nameIndex = 0; // Fallback to column index 0
        }
        
        // Calculate total amount from all donations (excluding header row)
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        // Process data rows
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i];
            
            // Skip malformed rows
            if (!columns || columns.length <= Math.max(amountIndex, nameIndex)) {
                continue;
            }
            
            // Process amount
            if (columns.length > amountIndex) {
                try {
                    let amountStr = columns[amountIndex];
                    amountStr = amountStr.replace(/[^\d.-]/g, '');
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount > 0) {
                        totalAmount += amount;
                    }
                } catch (error) {
                    console.warn(`Error processing amount in row ${i}`);
                }
            }
            
            // Process donor name
            if (nameIndex !== -1 && columns.length > nameIndex) {
                const name = columns[nameIndex].trim();
                if (name && name.length > 0) {
                    donorNames.push(name);
                }
            }
        }
        
        console.log(`Processed data - Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}`);
        
        // Reset error counter on successful fetch
        consecutiveErrorCount = 0;
        
        // Always update with the latest data
        lastValidTotal = totalAmount;
        lastValidDonorCount = donorCount;
        
        // Only update donor names if we have some
        if (donorNames.length > 0) {
            lastValidDonorNames = donorNames;
        }
        
        // Update display with animation
        updateDisplay(totalAmount, donorCount, lastValidDonorNames);
        
    } catch (error) {
        consecutiveErrorCount++;
        console.error(`Error fetching donation data (attempt ${consecutiveErrorCount}):`, error);
        
        // On error, maintain the last valid values
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
        
        // If we have too many consecutive errors, try exponential backoff
        if (consecutiveErrorCount > MAX_ERRORS) {
            const backoffTime = Math.min(30000, 1000 * Math.pow(2, consecutiveErrorCount - MAX_ERRORS));
            console.warn(`Too many consecutive errors. Next retry in ${backoffTime/1000} seconds`);
            
            // Clear existing interval and set a one-time timeout to try again
            if (window.refreshInterval) {
                clearInterval(window.refreshInterval);
            }
            
            setTimeout(() => {
                fetchDonationData();
                // Restart the normal interval after backoff
                window.refreshInterval = setInterval(fetchDonationData, REFRESH_INTERVAL);
            }, backoffTime);
            
            return;
        }
    }
}

// Helper function to calculate percentage
function calculatePercentage(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
    return Math.min(Math.max((amount / GOAL_AMOUNT) * 100, 0), 100);
}

// Helper function to format currency
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
    
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });
}

// Helper function to update the display
function updateDisplay(amount, donorCount, donorNames) {
    try {
        // Calculate percentage
        const percentage = calculatePercentage(amount);
        
        // Get current thermometer height
        const currentHeight = parseFloat(thermometerProgress.style.height || '0');
        
        // Update thermometer with animation only if value increased
        if (currentHeight < percentage) {
            thermometerProgress.classList.add('pulse');
            setTimeout(() => {
                thermometerProgress.classList.remove('pulse');
            }, 1000);
        }
        
        // Update thermometer height
        thermometerProgress.style.height = `${percentage}%`;
        
        // Update text
        currentAmountElement.textContent = `${formatCurrency(amount)} raised`;
        donorCountElement.textContent = `${donorCount} donation${donorCount !== 1 ? 's' : ''}`;
        
        // Update donor list
        if (donorNames && donorNames.length > 0) {
            donorListElement.innerHTML = donorNames.join(', ');
        } else {
            donorListElement.textContent = 'Thank you to all our supporters!';
        }
    } catch (error) {
        console.error('Error in updateDisplay:', error);
    }
}

// Ensure DOM is fully loaded before executing
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing donation tracker...');
    
    // Initial display with fallback values until first fetch
    updateDisplay(0, 0, []);
    
    // Fetch data immediately on load
    fetchDonationData();
    
    // Set up periodic refresh interval
    window.refreshInterval = setInterval(fetchDonationData, REFRESH_INTERVAL);
});
