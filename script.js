// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?gid=0&single=true&output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');

// Function to fetch and process CSV data
async function fetchDonationData() {
    try {
        const response = await fetch(CSV_URL);
        const csvData = await response.text();
        
        // Parse CSV data
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        const headers = rows[0].split(',');
        
        // Find column indices
        const amountIndex = headers.findIndex(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment')
        );
        
        if (amountIndex === -1) {
            console.error('Could not find amount column in CSV');
            return;
        }
        
        // Calculate total amount from all donations (excluding header row)
        let totalAmount = 0;
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            if (columns.length > amountIndex) {
                // Remove any non-numeric characters except decimal point
                const amountStr = columns[amountIndex].replace(/[^\d.]/g, '');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount)) {
                    totalAmount += amount;
                }
            }
        }
        
        // Calculate percentage of goal reached
        const percentage = Math.min((totalAmount / GOAL_AMOUNT) * 100, 100);
        
        // Update thermometer
        thermometerProgress.style.height = `${percentage}%`;
        
        // Format as currency
        const formattedAmount = totalAmount.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        });
        
        // Update text
        currentAmountElement.textContent = `${formattedAmount} raised`;
        donorCountElement.textContent = `${rows.length - 1} donations`;
        
        // Add animation class when updating
        thermometerProgress.classList.add('pulse');
        setTimeout(() => {
            thermometerProgress.classList.remove('pulse');
        }, 1000);
        
        console.log(`Data refreshed. Total: ${formattedAmount}, Percentage: ${percentage.toFixed(2)}%`);
        
    } catch (error) {
        console.error('Error fetching donation data:', error);
    }
}

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);

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

addPulseAnimation();
