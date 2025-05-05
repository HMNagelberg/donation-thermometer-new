// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 3000; // Changed to 3 seconds for quicker updates
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Store persistent values and set some initial values
let persistentValues = {
    total: 0,
    donorCount: 0,
    donorNames: []
};

// Try to load any previously stored values from localStorage
try {
    const savedValues = localStorage.getItem('donationValues');
    if (savedValues) {
        persistentValues = JSON.parse(savedValues);
        console.log('Loaded saved values:', persistentValues);
        
        // Immediately update the display with saved values
        updateDisplay(persistentValues.total, persistentValues.donorCount, persistentValues.donorNames);
    }
} catch (e) {
    console.error('Error loading saved values:', e);
}

// Track consecutive failures to prevent refresh loops
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

// Variable to track if we're currently fetching
let isFetching = false;

// Function to fetch and process CSV data
function fetchDonationData() {
    // Prevent concurrent fetches
    if (isFetching) return;
    isFetching = true;
    
    console.log('Fetching donation data...');
    
    // Add random parameter to avoid caching
    const timestamp = new Date().getTime();
    const randomParam = Math.floor(Math.random() * 1000000);
    const fetchUrl = `${CSV_URL}?timestamp=${timestamp}&random=${randomParam}`;
    
    fetch(fetchUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
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
            throw new Error('Empty CSV data received');
        }
        
        // Reset failure counter on success
        consecutiveFailures = 0;
        
        // Parse CSV data
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
            throw new Error('No rows found in CSV');
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
            console.warn('Could not find amount column in CSV. Headers:', headers);
            // Don't throw error, we'll try to adapt
        }
        
        // Calculate total amount from all donations (excluding header row)
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            
            // Process amount
            if (amountIndex !== -1 && columns.length > amountIndex) {
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
        
        // Only update if we got valid data
        if (donorCount > 0 && totalAmount > 0) {
            // Update persistent values
            persistentValues = {
                total: totalAmount,
                donorCount: donorCount,
                donorNames: donorNames
            };
            
            // Save to localStorage for persistence across page loads
            try {
                localStorage.setItem('donationValues', JSON.stringify(persistentValues));
            } catch (e) {
                console.error('Error saving values:', e);
            }
            
            // Update display
            updateDisplay(totalAmount, donorCount, donorNames);
            
            console.log(`Data refreshed. Total: ${formatCurrency(totalAmount)}, Donors: ${donorCount}, Percentage: ${calculatePercentage(totalAmount).toFixed(2)}%`);
        } else {
            console.warn('Invalid data received. Using persistent values.');
            updateDisplay(persistentValues.total, persistentValues.donorCount, persistentValues.donorNames);
        }
    })
    .catch(error => {
        console.error('Error fetching donation data:', error);
        
        // Increment failure counter
        consecutiveFailures++;
        
        console.warn(`Consecutive failures: ${consecutiveFailures}/${MAX_FAILURES}`);
        
        // Always use persistent values on error
        updateDisplay(persistentValues.total, persistentValues.donorCount, persistentValues.donorNames);
        
        // If too many consecutive failures, slow down the refresh rate temporarily
        // But will return to normal after a successful fetch
    })
    .finally(() => {
        isFetching = false;
        
        // Schedule the next refresh with appropriate interval based on failure count
        const nextInterval = consecutiveFailures >= MAX_FAILURES ? 
            REFRESH_INTERVAL * 2 : // Temporary slow down if having problems
            REFRESH_INTERVAL;
            
        setTimeout(fetchDonationData, nextInterval);
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
    
    // Update thermometer with smooth animation
    animateThermometer(percentage);
    
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

// Smooth thermometer animation
function animateThermometer(targetPercentage) {
    const currentHeight = parseFloat(thermometerProgress.style.height || '0');
    
    // Only animate if there's a significant change
    if (Math.abs(currentHeight - targetPercentage) < 0.5) return;
    
    const duration = 800; // 0.8 second animation (faster than before)
    const startTime = performance.now();
    const startHeight = currentHeight;
    
    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic: progress = 1 - Math.pow(1 - progress, 3)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const newHeight = startHeight + (targetPercentage - startHeight) * easeProgress;
        thermometerProgress.style.height = `${newHeight}%`;
        
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    
    requestAnimationFrame(step);
}

// Add a small debug indicator (can be removed for production)
function addDebugIndicator() {
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.bottom = '0';
    debugDiv.style.right = '0';
    debugDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    debugDiv.style.color = 'white';
    debugDiv.style.padding = '5px';
    debugDiv.style.fontSize = '10px';
    debugDiv.style.zIndex = '9999';
    debugDiv.id = 'debug-indicator';
    document.body.appendChild(debugDiv);
    
    // Update the debug indicator periodically
    setInterval(() => {
        debugDiv.innerHTML = `Updates: ${formatCurrency(persistentValues.total)} / ${persistentValues.donorCount} donors`;
    }, 1000);
}

// Uncomment for debugging - comment out for production
// addDebugIndicator();

// Start the fetch cycle immediately
fetchDonationData();

// Add a manual refresh function that can be called from browser console
window.manualRefresh = function() {
    console.log('Manual refresh triggered');
    fetchDonationData();
};
