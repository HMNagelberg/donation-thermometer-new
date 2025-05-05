// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // Back to 5 seconds to reduce potential issues
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
function fetchDonationData() {
    console.log('Fetching donation data...');
    
    // Add random parameter to avoid caching
    const timestamp = new Date().getTime();
    const randomParam = Math.floor(Math.random() * 1000000);
    const fetchUrl = `${CSV_URL}?timestamp=${timestamp}&random=${randomParam}`;
    
    fetch(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
    })
    .then(csvData => {
        if (!csvData || csvData.trim() === '') {
            console.error('Empty CSV data received');
            return;
        }
        
        // Parse CSV data
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            console.error('No rows found in CSV');
            return;
        }
        
        const headers = rows[0].split(',');
        
        // Find column indices
        const amountIndex = headers.findIndex(header => 
            header.toLowerCase().includes('amount') || 
            header.toLowerCase().includes('payment')
        );
        
        const nameIndex = headers.findIndex(header => 
            header.toLowerCase().includes('name') || 
            header.toLowerCase().includes('donor')
        );
        
        if (amountIndex === -1) {
            console.error('Could not find amount column in CSV');
            console.log('Headers found:', headers);
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
        
        // Store valid values
        lastValidTotal = totalAmount;
        lastValidDonorCount = donorCount;
        lastValidDonorNames = donorNames;
        
        // Update display
        updateDisplay(totalAmount, donorCount, donorNames);
        
        console.log(`Data refreshed. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Percentage: ${calculatePercentage(totalAmount).toFixed(2)}%`);
    })
    .catch(error => {
        console.error('Error fetching donation data:', error);
        // On error, use last valid values
        updateDisplay(lastValidTotal, lastValidDonorCount, lastValidDonorNames);
    });
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
    
    // Update thermometer
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

// Add debugging info to the page (will be hidden from users)
function addDebugInfo() {
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.bottom = '0';
    debugDiv.style.right = '0';
    debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
    debugDiv.style.color = 'white';
    debugDiv.style.padding = '10px';
    debugDiv.style.fontSize = '12px';
    debugDiv.style.zIndex = '9999';
    debugDiv.style.maxWidth = '300px';
    debugDiv.style.maxHeight = '200px';
    debugDiv.style.overflow = 'auto';
    debugDiv.id = 'debug-info';
    document.body.appendChild(debugDiv);
    
    // Test the CSV URL
    fetch(CSV_URL, { method: 'HEAD' })
        .then(response => {
            debugDiv.innerHTML += `<div>CSV URL status: ${response.status} ${response.ok ? 'OK' : 'FAILED'}</div>`;
        })
        .catch(error => {
            debugDiv.innerHTML += `<div>CSV URL error: ${error.message}</div>`;
        });
}

// Initial setup - you can comment this out after debugging
addDebugInfo();

// Fetch data immediately on load
fetchDonationData();

// Set up periodic refresh
setInterval(fetchDonationData, REFRESH_INTERVAL);

// Additional debug function you can call from browser console
window.testCSV = function() {
    const debugDiv = document.getElementById('debug-info');
    debugDiv.innerHTML = '<div>Testing CSV connection...</div>';
    
    fetch(CSV_URL)
        .then(response => response.text())
        .then(text => {
            if(text && text.length > 0) {
                debugDiv.innerHTML += `<div>CSV data received: ${text.substring(0, 100)}...</div>`;
            } else {
                debugDiv.innerHTML += `<div>Empty CSV data received</div>`;
            }
        })
        .catch(error => {
            debugDiv.innerHTML += `<div>CSV fetch error: ${error.message}</div>`;
        });
};
