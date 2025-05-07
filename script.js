// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
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

// Function to fetch and process CSV data
async function fetchDonationData() {
    try {
        const response = await fetch(CSV_URL + '&_=' + new Date().getTime(), {
            method: 'GET',
            cache: 'no-store', // Prevent caching
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const csvData = await response.text();
        
        // Parse CSV data using PapaParse for better reliability
        const results = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });
        
        // Validate that we have actual CSV data
        if (!results.data || results.data.length === 0) {
            console.error('No valid data found in CSV');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        // Find column for amount and name
        const headers = results.meta.fields;
        
        // Find column indices by checking each column header
        const amountColumn = headers.find(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment')
        );
        
        const nameColumn = headers.find(header => 
            header.toLowerCase().includes('name') || 
            header.toLowerCase().includes('donor')
        );
        
        if (!amountColumn) {
            console.error('Could not find amount column in CSV');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        // Calculate total amount from all donations
        let totalAmount = 0;
        const donorCount = results.data.length;
        const donorNames = [];
        
        for (const row of results.data) {
            // Process amount
            if (row[amountColumn] !== undefined && row[amountColumn] !== null) {
                let amount;
                
                // If already a number, use directly
                if (typeof row[amountColumn] === 'number') {
                    amount = row[amountColumn];
                } else {
                    // Otherwise, try to parse it
                    const amountStr = String(row[amountColumn]).replace(/[^\d.]/g, '');
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
        }
        
        // Validate total (ensure it's not less than previous valid total)
        if (donorCount < lastValidDonorCount || totalAmount < lastValidTotal) {
            console.warn('New total is less than previous valid total. Possible data issue. Keeping previous values.');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        // Update stored valid values
        lastValidTotal = totalAmount;
        lastValidDonorCount = donorCount;
        lastValidDonorNames = donorNames;
        
        // Update display
        updateDisplay(totalAmount, donorCount, donorNames);
        
        console.log(`Data refreshed. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Percentage: ${calculatePercentage(totalAmount).toFixed(2)}%`);
        
    } catch (error) {
        console.error('Error fetching donation data:', error);
        // On error, maintain the last valid values
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
    }
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
    
    // Update thermometer with animation only if value increased
    if (parseFloat(thermometerProgress.style.height || '0') < percentage) {
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
    
    // Update donor list - show all donors
    if (donorNames && donorNames.length > 0) {
        donorListElement.innerHTML = donorNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Initial setup - ensure thermometer has an initial height
thermometerProgress.style.height = '0%';

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);
