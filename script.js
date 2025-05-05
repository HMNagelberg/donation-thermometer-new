// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 5000; // 5 seconds
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Last known values
let currentAmount = 0;
let currentDonorCount = 0;
let currentDonorNames = [];

// Create a status indicator
function createStatusIndicator() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-indicator';
    statusDiv.style.position = 'fixed';
    statusDiv.style.bottom = '10px';
    statusDiv.style.right = '10px';
    statusDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    statusDiv.style.color = 'white';
    statusDiv.style.padding = '8px';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.fontSize = '12px';
    statusDiv.style.zIndex = '9999';
    
    statusDiv.innerHTML = `
        <div>Status: <span id="status-text">Initializing...</span></div>
        <div>
            <button id="refresh-btn" style="margin-right: 5px;">Refresh Now</button>
            <button id="hide-btn">Hide</button>
        </div>
    `;
    
    document.body.appendChild(statusDiv);
    
    // Add button handlers
    document.getElementById('refresh-btn').addEventListener('click', function() {
        updateStatus('Manually refreshing...');
        fetchData();
    });
    
    document.getElementById('hide-btn').addEventListener('click', function() {
        statusDiv.style.display = 'none';
    });
}

// Update status message
function updateStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.textContent = message;
    }
    console.log('Status:', message);
}

// Use a simple JSONP approach with a callback to avoid CORS issues
function fetchDataWithJSONP() {
    updateStatus('Trying JSONP approach...');
    
    // Create a unique callback name
    const callbackName = 'googleCallback' + Date.now();
    
    // Create global callback function
    window[callbackName] = function(data) {
        // Clean up
        document.body.removeChild(script);
        delete window[callbackName];
        
        // Process the data
        updateStatus('Data received, processing...');
        processCSVData(data);
    };
    
    // Create script element
    const script = document.createElement('script');
    script.src = CSV_URL + '&callback=' + callbackName + '&_=' + Date.now();
    script.onerror = function() {
        // Clean up
        document.body.removeChild(script);
        delete window[callbackName];
        
        // Try direct fetch as fallback
        updateStatus('JSONP failed, trying direct fetch...');
        fetchDataWithFetch();
    };
    
    // Add to document to start the request
    document.body.appendChild(script);
}

// Fetch data using the standard Fetch API
function fetchDataWithFetch() {
    updateStatus('Fetching data...');
    
    // Add cache-busting query parameter
    const fetchUrl = CSV_URL + '?_=' + Date.now();
    
    fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.text();
    })
    .then(data => {
        updateStatus('Data received');
        processCSVData(data);
    })
    .catch(error => {
        updateStatus('Fetch error: ' + error.message);
        console.error('Fetch error:', error);
        
        // Try our JSONP approach as a fallback
        fetchDataWithJSONP();
    });
}

// Main fetch function - tries different methods
function fetchData() {
    // Start with the direct fetch method first
    fetchDataWithFetch();
}

// Process CSV data
function processCSVData(csvData) {
    try {
        // Check if we have data
        if (!csvData || csvData.trim() === '') {
            updateStatus('No data received');
            return;
        }
        
        // Split into rows and remove empty ones
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length <= 1) {
            updateStatus('No data rows found');
            return;
        }
        
        // Extract headers
        const headers = rows[0].split(',');
        
        // Find the amount and name columns
        const amountIndex = findColumn(headers, ['amount', 'payment', 'donation']);
        const nameIndex = findColumn(headers, ['name', 'donor']);
        
        if (amountIndex === -1) {
            updateStatus('Amount column not found');
            console.warn('Headers:', headers);
            return;
        }
        
        // Process data rows
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            
            // Get amount
            if (columns.length > amountIndex) {
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
        
        // Only update if we have valid data
        if (totalAmount > 0) {
            updateStatus('Data processed: ' + formatCurrency(totalAmount) + ' from ' + donorCount + ' donors');
            
            // Update our stored values
            currentAmount = totalAmount;
            currentDonorCount = donorCount;
            currentDonorNames = donorNames;
            
            // Update the display
            updateDisplay();
        } else {
            updateStatus('Invalid data (zero total)');
        }
    } catch (error) {
        updateStatus('Data processing error: ' + error.message);
        console.error('Processing error:', error);
    }
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

// Update the visual display
function updateDisplay() {
    // Calculate percentage
    const percentage = Math.min((currentAmount / GOAL_AMOUNT) * 100, 100);
    
    // Update thermometer
    thermometerProgress.style.height = `${percentage}%`;
    
    // Update text
    currentAmountElement.textContent = `${formatCurrency(currentAmount)} raised`;
    donorCountElement.textContent = `${currentDonorCount} donations`;
    
    // Update donor list
    if (currentDonorNames.length > 0) {
        donorListElement.innerHTML = currentDonorNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(amount);
}

// Initialize
function initialize() {
    // Create status indicator
    createStatusIndicator();
    updateStatus('Initializing...');
    
    // Initial fetch
    fetchData();
    
    // Set up refresh interval
    setInterval(fetchData, REFRESH_INTERVAL);
}

// Start when page is loaded
window.addEventListener('load', initialize);

// Make refresh available globally for debugging
window.refreshData = fetchData;
