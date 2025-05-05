// Configuration
const GOAL_AMOUNT = 1000000;
const REFRESH_INTERVAL = 4000; // 4 seconds
const CSV_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvwDVAwZcxpGpU9SwIfmJS19N1z_XMx8Txw0PIKFRYbbX9Vaffdm6GKyEhXwpSHUPNObHVaScBKilf/pub?output=csv';

// DOM Elements
const thermometerProgress = document.getElementById('thermometer-progress');
const currentAmountElement = document.getElementById('current-amount');
const donorCountElement = document.getElementById('donor-count');
const donorListElement = document.getElementById('donor-list');

// Track values 
let currentValues = {
    amount: 0,
    donorCount: 0,
    donorNames: []
};

// Debug status element
let statusElement = null;

// Create status indicators
function setupDebugPanel() {
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.bottom = '10px';
    debugDiv.style.right = '10px';
    debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
    debugDiv.style.color = '#fff';
    debugDiv.style.padding = '8px';
    debugDiv.style.borderRadius = '4px';
    debugDiv.style.fontSize = '14px';
    debugDiv.style.fontFamily = 'monospace';
    debugDiv.style.zIndex = '9999';
    debugDiv.style.display = 'flex';
    debugDiv.style.flexDirection = 'column';
    debugDiv.style.gap = '5px';
    debugDiv.innerHTML = `
        <div>
            <span id="status-indicator">⚪</span> 
            <span id="status-text">Initializing...</span>
            <button id="hide-debug" style="margin-left: 10px;">Hide</button>
            <button id="force-refresh" style="margin-left: 5px;">Refresh Now</button>
        </div>
        <div id="data-status"></div>
    `;
    
    document.body.appendChild(debugDiv);
    statusElement = document.getElementById('status-text');
    
    // Add event listeners
    document.getElementById('hide-debug').addEventListener('click', () => {
        debugDiv.style.display = 'none';
    });
    
    document.getElementById('force-refresh').addEventListener('click', () => {
        fetchWithAntiCache();
    });
}

// Function to fetch data with strong anti-caching measures
function fetchWithAntiCache() {
    updateStatus('🔄', 'Fetching data...');
    
    // Create a unique URL each time to bypass cache
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fetchUrl = `${CSV_BASE_URL}?_t=${timestamp}&_r=${random}`;
    
    // Use XMLHttpRequest for more control over caching
    const xhr = new XMLHttpRequest();
    xhr.open('GET', fetchUrl, true);
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.setRequestHeader('Expires', '0');
    
    xhr.onload = function() {
        if (xhr.status === 200) {
            updateStatus('✅', 'Data received');
            processCSVData(xhr.responseText);
        } else {
            updateStatus('❌', `Error: HTTP ${xhr.status}`);
            console.error('HTTP Error:', xhr.status);
        }
    };
    
    xhr.onerror = function() {
        updateStatus('❌', 'Network error');
        console.error('Network Error');
    };
    
    xhr.send();
}

// Process the CSV data
function processCSVData(csvData) {
    if (!csvData || csvData.trim() === '') {
        updateStatus('⚠️', 'Empty CSV data');
        return;
    }
    
    try {
        // Split into rows and filter out empty ones
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length <= 1) {
            updateStatus('⚠️', 'No data rows found');
            return;
        }
        
        // Parse header row to find columns
        const headerRow = rows[0];
        const headers = parseCSVRow(headerRow);
        
        // Find relevant column indices
        const amountIndex = findColumnIndex(headers, ['amount', 'payment', 'donation']);
        const nameIndex = findColumnIndex(headers, ['name', 'donor', 'participant']);
        
        if (amountIndex === -1) {
            updateStatus('⚠️', 'Amount column not found');
            document.getElementById('data-status').textContent = 
                `Headers found: ${headers.join(', ')}`;
            return;
        }
        
        // Process all data rows
        let totalAmount = 0;
        const donorCount = rows.length - 1;
        const donorNames = [];
        
        for (let i = 1; i < rows.length; i++) {
            const rowData = parseCSVRow(rows[i]);
            
            // Get amount
            if (rowData.length > amountIndex) {
                // Handle amount - clean it and convert to number
                const amountStr = rowData[amountIndex].replace(/[^\d.]/g, '');
                const amount = parseFloat(amountStr);
                if (!isNaN(amount)) {
                    totalAmount += amount;
                }
            }
            
            // Get name
            if (nameIndex !== -1 && rowData.length > nameIndex) {
                const name = rowData[nameIndex].trim();
                if (name) donorNames.push(name);
            }
        }
        
        // Update status with data summary
        const dataStatusEl = document.getElementById('data-status');
        dataStatusEl.textContent = `Found ${donorCount} donations totaling ${formatCurrency(totalAmount)}`;
        
        // Update the display
        updateValues(totalAmount, donorCount, donorNames);
        
    } catch (error) {
        updateStatus('❌', `Parse error: ${error.message}`);
        console.error('Error processing CSV:', error);
    }
}

// Properly parse CSV row (handles quoted fields with commas)
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

// Find column index by possible names
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

// Update the current values and display
function updateValues(amount, donorCount, donorNames) {
    // Only update if we have valid data
    if (amount > 0 && donorCount > 0) {
        currentValues = {
            amount: amount,
            donorCount: donorCount,
            donorNames: donorNames
        };
        
        // Update the display
        updateDisplay();
    }
}

// Update the visual display
function updateDisplay() {
    // Calculate percentage
    const percentage = Math.min((currentValues.amount / GOAL_AMOUNT) * 100, 100);
    
    // Update thermometer with simple animation
    animateHeight(thermometerProgress, percentage);
    
    // Update text elements
    currentAmountElement.textContent = `${formatCurrency(currentValues.amount)} raised`;
    donorCountElement.textContent = `${currentValues.donorCount} donations`;
    
    // Update donor list
    if (currentValues.donorNames.length > 0) {
        donorListElement.innerHTML = currentValues.donorNames.join(', ');
    } else {
        donorListElement.textContent = 'No donor names available';
    }
}

// Simple height animation
function animateHeight(element, targetPercentage) {
    // Get current height
    const currentHeight = parseFloat(element.style.height || '0');
    
    // Only animate if there's a significant change
    if (Math.abs(currentHeight - targetPercentage) < 0.5) return;
    
    // Set the new height directly for better performance
    element.style.height = `${targetPercentage}%`;
    
    // Add a simple animation class
    element.classList.add('pulse');
    setTimeout(() => {
        element.classList.remove('pulse');
    }, 700);
}

// Format currency
function formatCurrency(amount) {
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    });
}

// Update status indicator
function updateStatus(icon, message) {
    const indicator = document.getElementById('status-indicator');
    if (indicator) indicator.textContent = icon;
    
    if (statusElement) statusElement.textContent = message;
}

// Initialize and start
function initialize() {
    setupDebugPanel();
    updateStatus('🚀', 'Starting...');
    
    // Fetch data immediately
    fetchWithAntiCache();
    
    // Set up interval for regular updates
    setInterval(fetchWithAntiCache, REFRESH_INTERVAL);
}

// Start everything when the page loads
window.addEventListener('load', initialize);

// Make refresh function available globally
window.manualRefresh = fetchWithAntiCache;
