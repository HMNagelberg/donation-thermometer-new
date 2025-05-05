// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 2000; // Reduced to 2 seconds from 5 seconds
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Store previous valid values
let lastValidTotal = 0;
let lastValidDonorCount = 0;
let lastValidDonorNames = [];
let lastFetchTime = 0;
let pendingFetch = false;

// Function to fetch and process CSV data
async function fetchDonationData() {
    // Prevent multiple concurrent fetches
    if (pendingFetch) return;
    pendingFetch = true;
    
    try {
        // Add timestamp and random parameter to bust cache more effectively
        const randomParam = Math.random().toString(36).substring(2, 15);
        const fetchUrl = `${CSV_URL}&_t=${Date.now()}&_r=${randomParam}`;
        
        console.log('Fetching donation data...');
        const response = await fetch(fetchUrl, {
            method: 'GET',
            cache: 'no-store', // Prevent caching
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Process the data only if it's not empty
        if (csvData && csvData.trim() !== '') {
            processCSVData(csvData);
        } else {
            console.warn('Empty CSV data received');
            // Keep previous valid values
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
        }
    } catch (error) {
        console.error('Error fetching donation data:', error);
        // On error, maintain the last valid values
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
    } finally {
        pendingFetch = false;
        lastFetchTime = Date.now();
    }
}

// Separate function to process CSV data
function processCSVData(csvData) {
    try {
        // Parse CSV data using a more robust approach
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            console.error('No rows found in CSV');
            return;
        }
        
        // Extract headers (first row)
        const headers = parseCSVRow(rows[0]);
        
        // Find column indices with more flexible matching
        const amountIndex = findColumnIndex(headers, ['amount', 'payment', 'donation', 'sum', 'total']);
        const nameIndex = findColumnIndex(headers, ['name', 'donor', 'person', 'contributor']);
        
        if (amountIndex === -1) {
            console.error('Could not find amount column in CSV');
            return;
        }
        
        // Process donation data
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const columns = parseCSVRow(rows[i]);
            
            // Process amount
            if (columns.length > amountIndex) {
                // Remove any non-numeric characters except decimal point
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
        
        // Update stored valid values
        lastValidTotal = totalAmount;
        lastValidDonorCount = donorCount;
        lastValidDonorNames = donorNames;
        
        // Update display
        updateDisplay(totalAmount, donorCount, donorNames);
        
        console.log(`Data refreshed. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Percentage: ${calculatePercentage(totalAmount).toFixed(2)}%`);
    } catch (error) {
        console.error('Error processing CSV data:', error);
        // Keep previous display on processing error
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
    }
}

// Helper function to parse CSV row, handling quotes and commas properly
function parseCSVRow(row) {
    const result = [];
    let insideQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(currentValue);
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    // Add the last value
    result.push(currentValue);
    return result;
}

// Helper function to find column index with flexible matching
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
    
    // Update thermometer with animation only if value changed
    const currentHeight = parseFloat(thermometerProgress.style.height) || 0;
    if (Math.abs(currentHeight - percentage) > 0.5) {
        thermometerProgress.classList.add('pulse');
        setTimeout(() => {
            thermometerProgress.classList.remove('pulse');
        }, 1000);
    }
    
    // Update thermometer height - use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
        thermometerProgress.style.height = `${percentage}%`;
    });
    
    // Update text
    currentAmountElement.textContent = `${formatCurrency(amount)} raised`;
    donorCountElement.textContent = `${donorCount} donations`;
    
    // Update donor list
    if (donorNames && donorNames.length > 0) {
        // Sort donor names alphabetically for consistency
        const sortedNames = [...donorNames].sort();
        donorListElement.innerHTML = sortedNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Add a little animation for when new donations come in
function addPulseAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .pulse {
            animation: pulse 1s ease-in-out;
        }
    `;
    document.head.appendChild(style);
}

// Check if Google Sheets is already published
function checkGoogleSheetsPublished() {
    fetch(CSV_URL, {
        method: 'HEAD',
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            console.warn('Google Sheet may not be published correctly. Response status:', response.status);
        } else {
            console.log('Google Sheet is published and accessible');
        }
    })
    .catch(error => {
        console.error('Error checking Google Sheet:', error);
    });
}

// Function to handle user visibility changes
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        // When user returns to the page, fetch immediately
        fetchDonationData();
    }
}

// Initial setup
addPulseAnimation();
checkGoogleSheetsPublished();

// Add visibility change listener to fetch data when user returns to page
document.addEventListener('visibilitychange', handleVisibilityChange);

// Initialize display with zero values
updateDisplay(0, 0, []);

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh with a debounce mechanism
function startPeriodicRefresh() {
    const refresh = () => {
        const now = Date.now();
        // Only fetch if not pending and it's been at least REFRESH_INTERVAL since last fetch
        if (!pendingFetch && now - lastFetchTime >= REFRESH_INTERVAL) {
            fetchDonationData();
        }
        requestAnimationFrame(() => setTimeout(refresh, REFRESH_INTERVAL));
    };
    refresh();
}

// Start periodic refresh
startPeriodicRefresh();
