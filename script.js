// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 3000; // Reduced to 3 seconds for more frequent updates
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?gid=0&single=true&output=csv';

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
        // Add a random query parameter to prevent caching
        const timestamp = new Date().getTime();
        const randomParam = Math.floor(Math.random() * 1000000);
        const noCacheUrl = `${CSV_URL}&_=${timestamp}&r=${randomParam}`;
        
        const response = await fetch(noCacheUrl, {
            method: 'GET',
            cache: 'no-store', // Prevent caching
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            // Add a timeout to prevent hanging requests
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Validate that we have actual CSV data
        if (!csvData || csvData.trim() === '') {
            throw new Error('Empty CSV data received');
        }
        
        // Parse CSV data - improved error handling
        const rows = csvData.split('\n')
            .filter(row => row.trim() !== '')
            .map(row => row.split(',').map(cell => cell.trim()));
        
        // Validate that we have at least a header row
        if (rows.length === 0) {
            throw new Error('No rows found in CSV');
        }
        
        const headers = rows[0];
        
        // Find column indices with more robust fallbacks
        let amountIndex = headers.findIndex(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment') ||
            header.toLowerCase().includes('donation')
        );
        
        // Fallback if column not found - assume second column (index 1) might be amount
        if (amountIndex === -1) {
            console.warn('Could not identify amount column by name. Using fallback column index 1.');
            amountIndex = 1;
        }
        
        // Find name column index with improved fallbacks
        let nameIndex = headers.findIndex(header => 
            header.toLowerCase().includes('name') || 
            header.toLowerCase().includes('donor') ||
            header.toLowerCase().includes('person')
        );
        
        // Fallback if name column not found - assume first column (index 0) might be name
        if (nameIndex === -1) {
            console.warn('Could not identify name column by name. Using fallback column index 0.');
            nameIndex = 0;
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
                console.warn(`Skipping row ${i}: Insufficient columns`);
                continue;
            }
            
            // Process amount with improved parsing
            if (columns.length > amountIndex) {
                try {
                    // Handle various currency formats
                    let amountStr = columns[amountIndex];
                    
                    // Remove currency symbols and non-numeric chars except decimal point and digits
                    amountStr = amountStr.replace(/[^\d.-]/g, '');
                    
                    const amount = parseFloat(amountStr);
                    if (!isNaN(amount) && amount > 0) {
                        totalAmount += amount;
                    } else {
                        console.warn(`Invalid amount in row ${i}: ${columns[amountIndex]}`);
                    }
                } catch (error) {
                    console.warn(`Error processing amount in row ${i}:`, error);
                }
            }
            
            // Process donor name with improved handling
            if (nameIndex !== -1 && columns.length > nameIndex) {
                const name = columns[nameIndex].trim();
                if (name && name.length > 0 && !name.toLowerCase().includes('test') && !name.toLowerCase().includes('header')) {
                    donorNames.push(name);
                }
            }
        }
        
        console.log(`Processed data - Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Names: ${donorNames.length}`);
        
        // Reset error counter on successful fetch
        consecutiveErrorCount = 0;
        
        // Validate total (prevent fluctuations)
        // Only update if new total is higher or donor count increased
        if (donorCount >= lastValidDonorCount && totalAmount >= lastValidTotal) {
            // Update stored valid values
            lastValidTotal = totalAmount;
            lastValidDonorCount = donorCount;
            
            // Only update donor names if we have some
            if (donorNames.length > 0) {
                lastValidDonorNames = donorNames;
            }
            
            // Update display with animation
            updateDisplay(totalAmount, donorCount, lastValidDonorNames);
            console.log(`Data updated successfully. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}`);
        } else {
            console.warn(`New values lower than previous values. Keeping previous values.
                Previous: ${formatCurrency(lastValidTotal)}, ${lastValidDonorCount} donors
                New: ${formatCurrency(totalAmount)}, ${donorCount} donors`);
            
            // Still update the display with last valid values (in case of page refresh)
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
        }
        
    } catch (error) {
        consecutiveErrorCount++;
        console.error(`Error fetching donation data (attempt ${consecutiveErrorCount}):`, error);
        
        // On error, maintain the last valid values
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
        
        // If we have too many consecutive errors, try an exponential backoff approach
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

// Helper function to calculate percentage with better clamping
function calculatePercentage(amount) {
    // Ensure we have valid input, default to 0
    if (typeof amount !== 'number' || isNaN(amount)) {
        console.warn('Invalid amount provided to calculatePercentage:', amount);
        amount = 0;
    }
    
    // Ensure always between 0-100%
    return Math.min(Math.max((amount / GOAL_AMOUNT) * 100, 0), 100);
}

// Helper function to format currency
function formatCurrency(amount) {
    // Ensure we have valid input, default to 0
    if (typeof amount !== 'number' || isNaN(amount)) {
        console.warn('Invalid amount provided to formatCurrency:', amount);
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
        // Ensure we have valid input
        if (typeof amount !== 'number' || isNaN(amount)) {
            console.warn('Invalid amount provided to updateDisplay:', amount);
            amount = lastValidTotal || 0;
        }
        
        if (typeof donorCount !== 'number' || isNaN(donorCount)) {
            console.warn('Invalid donorCount provided to updateDisplay:', donorCount);
            donorCount = lastValidDonorCount || 0;
        }
        
        // Calculate percentage
        const percentage = calculatePercentage(amount);
        
        // Get current thermometer height (defaulting to 0 if not set)
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
    
    // Initial display (fallback values until first fetch)
    updateDisplay(0, 0, []);
    
    // Fetch data immediately on load
    fetchDonationData();
    
    // Set up periodic refresh interval
    window.refreshInterval = setInterval(fetchDonationData, REFRESH_INTERVAL);
    
    // Add a visual indicator for when data refreshes
    setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`Check for updates at ${timestamp}`);
    }, REFRESH_INTERVAL);
});
