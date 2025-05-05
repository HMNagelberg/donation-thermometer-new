// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
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
        
        // Validate that we have actual CSV data
        if (!csvData || csvData.trim() === '') {
            console.error('Empty CSV data received');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        // Parse CSV data
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        // Validate that we have at least a header row
        if (rows.length === 0) {
            console.error('No rows found in CSV');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        const headers = rows[0].split(',');
        
        // Find column indices
        const amountIndex = headers.findIndex(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment')
        );
        
        // Find name column index
        const nameIndex = headers.findIndex(header => 
            header.toLowerCase().includes('name') || 
            header.toLowerCase().includes('donor')
        );
        
        if (amountIndex === -1) {
            console.error('Could not find amount column in CSV');
            updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
            return;
        }
        
        // Calculate total amount from all donations (excluding header row)
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            
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
    if (parseFloat(thermometerProgress.style.height) < percentage) {
        thermometerProgress.classList.add('pulse');
        setTimeout(() => {
            thermometerProgress.classList.remove('pulse');
        }, 1000);
    }
    
    // Update thermometer height
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

// Initial setup
addPulseAnimation();

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);
