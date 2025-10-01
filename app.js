// Check if service worker is supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('✅ Service Worker registered successfully!', reg))
            .catch(err => console.log('❌ Service Worker registration failed:', err));
    });
}

// Test localStorage immediately
console.log('🔍 Testing localStorage...');
try {
    localStorage.setItem('test', 'works');
    const test = localStorage.getItem('test');
    console.log('✅ localStorage test result:', test);
    localStorage.removeItem('test');
} catch (e) {
    console.error('❌ localStorage is blocked or not available:', e);
}

// Date filter state
let currentFilter = 'all';
let customStartDate = null;
let customEndDate = null;

// Load sales reps from localStorage with enhanced data structure
let salesReps = [];
try {
    const stored = localStorage.getItem('salesReps');
    console.log('📦 Raw data from localStorage:', stored);

    if (stored) {
        salesReps = JSON.parse(stored);
        // Migrate old data to new structure if needed
        salesReps = salesReps.map(rep => {
            if (!rep.dealHistory) {
                return {
                    ...rep,
                    revenue: 0,
                    dealHistory: []
                };
            }
            return rep;
        });
        console.log('✅ Parsed salesReps:', salesReps);
    } else {
        console.log('ℹ️ No saved data found, starting fresh');
    }
} catch (e) {
    console.error('❌ Error loading data:', e);
    salesReps = [];
}

// DOM Elements
const repNameInput = document.getElementById('repName');
const addRepBtn = document.getElementById('addRepBtn');
const salesBoard = document.getElementById('salesBoard');

// Initialize the board
renderSalesBoard();
updateStats();
updateAnalytics();

// Add new rep
addRepBtn.addEventListener('click', addRep);
repNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addRep();
});

function addRep() {
    const name = repNameInput.value.trim();

    if (name === '') {
        alert('Please enter a sales rep name!');
        return;
    }

    // Check for duplicates
    if (salesReps.find(rep => rep.name.toLowerCase() === name.toLowerCase())) {
        alert('This sales rep already exists!');
        return;
    }

    salesReps.push({
        id: Date.now(),
        name: name,
        deals: 0,
        revenue: 0,
        dealHistory: []
    });

    console.log('➕ Added new rep:', name);
    saveData();
    renderSalesBoard();
    updateStats();
    updateAnalytics();
    repNameInput.value = '';
    repNameInput.focus();
}

function addDeal(id) {
    const rep = salesReps.find(r => r.id === id);
    if (!rep) return;

    // Prompt for deal value
    const dealValue = prompt(`Enter deal value for ${rep.name} (or press OK for $0):`, '0');

    if (dealValue === null) return; // User cancelled

    const value = parseFloat(dealValue) || 0;

    rep.deals++;
    rep.revenue += value;
    rep.dealHistory.push({
        date: new Date().toISOString(),
        amount: value
    });

    console.log('📈 Added deal for:', rep.name, 'Amount:', value, 'Total deals:', rep.deals);
    saveData();
    renderSalesBoard();
    updateStats();
    updateAnalytics();
}

function removeRep(id) {
    if (confirm('Are you sure you want to remove this sales rep?')) {
        const rep = salesReps.find(r => r.id === id);
        console.log('🗑️ Removing rep:', rep ? rep.name : 'Unknown');
        salesReps = salesReps.filter(r => r.id !== id);
        saveData();
        renderSalesBoard();
        updateStats();
        updateAnalytics();
    }
}

function getFilteredDeals(rep) {
    if (currentFilter === 'all') {
        return rep.dealHistory;
    }

    const now = new Date();
    let startDate;

    switch (currentFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'custom':
            if (!customStartDate || !customEndDate) return rep.dealHistory;
            startDate = new Date(customStartDate);
            const endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
            return rep.dealHistory.filter(deal => {
                const dealDate = new Date(deal.date);
                return dealDate >= startDate && dealDate <= endDate;
            });
        default:
            return rep.dealHistory;
    }

    return rep.dealHistory.filter(deal => new Date(deal.date) >= startDate);
}

function getFilteredStats(rep) {
    const filteredDeals = getFilteredDeals(rep);
    return {
        deals: filteredDeals.length,
        revenue: filteredDeals.reduce((sum, deal) => sum + deal.amount, 0)
    };
}

function updateStats() {
    let totalDeals = 0;
    let totalRevenue = 0;

    salesReps.forEach(rep => {
        const stats = getFilteredStats(rep);
        totalDeals += stats.deals;
        totalRevenue += stats.revenue;
    });

    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    document.getElementById('totalDeals').textContent = totalDeals;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgDealSize').textContent = formatCurrency(avgDealSize);
}

function updateAnalytics() {
    // Top Performer
    if (salesReps.length > 0) {
        const topPerformer = salesReps.reduce((top, rep) => {
            const stats = getFilteredStats(rep);
            const topStats = getFilteredStats(top);
            return stats.revenue > topStats.revenue ? rep : top;
        });
        document.getElementById('topPerformer').textContent = topPerformer.name;
    } else {
        document.getElementById('topPerformer').textContent = '-';
    }

    // Highest Single Deal
    let highestDeal = 0;
    salesReps.forEach(rep => {
        const deals = getFilteredDeals(rep);
        deals.forEach(deal => {
            if (deal.amount > highestDeal) {
                highestDeal = deal.amount;
            }
        });
    });
    document.getElementById('highestDeal').textContent = formatCurrency(highestDeal);

    // Total Reps
    document.getElementById('totalReps').textContent = salesReps.length;

    // Deals Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let dealsToday = 0;
    salesReps.forEach(rep => {
        rep.dealHistory.forEach(deal => {
            const dealDate = new Date(deal.date);
            dealDate.setHours(0, 0, 0, 0);
            if (dealDate.getTime() === today.getTime()) {
                dealsToday++;
            }
        });
    });
    document.getElementById('dealsToday').textContent = dealsToday;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderSalesBoard() {
    console.log('🎨 Rendering board with', salesReps.length, 'reps');

    if (salesReps.length === 0) {
        salesBoard.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; opacity: 0.5;">
                <h2>No sales reps yet!</h2>
                <p style="margin-top: 15px;">Add your first rep to get started tracking deals.</p>
            </div>
        `;
        return;
    }

    salesBoard.innerHTML = salesReps
        .map(rep => {
            const stats = getFilteredStats(rep);
            return { ...rep, filteredDeals: stats.deals, filteredRevenue: stats.revenue };
        })
        .sort((a, b) => b.filteredRevenue - a.filteredRevenue)
        .map(rep => `
            <div class="rep-card">
                <div class="rep-name">${rep.name}</div>
                <div class="revenue-display">
                    <div class="revenue-amount">${formatCurrency(rep.filteredRevenue)}</div>
                    <div style="opacity: 0.7; font-size: 0.9em;">
                        ${currentFilter === 'all' ? 'Total Revenue' : 'Filtered Revenue'}
                    </div>
                </div>
                <div class="deal-count">${rep.filteredDeals}</div>
                <div class="deal-label">
                    ${currentFilter === 'all' ? 'Deals Closed' : 'Deals in Period'}
                </div>
                ${getFilteredDeals(rep).length > 0 ? `
                    <div class="deal-history">
                        ${getFilteredDeals(rep).slice(-5).reverse().map(deal => `
                            <div class="deal-item">
                                <span class="deal-date">${formatDate(deal.date)}</span>
                                <span class="deal-amount">${formatCurrency(deal.amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="card-buttons">
                    <button class="add-deal-btn" onclick="addDeal(${rep.id})">
                        + ADD DEAL
                    </button>
                    <button class="remove-rep-btn" onclick="removeRep(${rep.id})">
                        🗑️ REMOVE
                    </button>
                </div>
            </div>
        `).join('');
}

function saveData() {
    try {
        const dataToSave = JSON.stringify(salesReps);
        console.log('💾 Saving data:', dataToSave);
        localStorage.setItem('salesReps', dataToSave);

        // Verify it was saved
        const verify = localStorage.getItem('salesReps');
        console.log('✅ Verified saved data:', verify);
    } catch (e) {
        console.error('❌ Error saving data:', e);
        alert('Error saving data! Check if your browser allows localStorage.');
    }
}

// Date filter functionality
document.getElementById('dateFilter').addEventListener('change', function(e) {
    currentFilter = e.target.value;

    if (currentFilter === 'custom') {
        document.getElementById('customDateRange').style.display = 'flex';
    } else {
        document.getElementById('customDateRange').style.display = 'none';
        applyDateFilter();
    }
});

document.getElementById('applyDateFilter').addEventListener('click', function() {
    customStartDate = document.getElementById('startDate').value;
    customEndDate = document.getElementById('endDate').value;

    if (!customStartDate || !customEndDate) {
        alert('Please select both start and end dates');
        return;
    }

    applyDateFilter();
});

function applyDateFilter() {
    renderSalesBoard();
    updateStats();
    updateAnalytics();
}

// Export to CSV
document.getElementById('exportBtn').addEventListener('click', exportToCSV);
document.getElementById('exportJsonBtn').addEventListener('click', exportToJSON);

function exportToCSV() {
    if (salesReps.length === 0) {
        alert('No data to export!');
        return;
    }

    // Create CSV header
    let csv = 'Sales Rep,Total Deals,Total Revenue,Average Deal Size,Last Deal Date\n';

    // Add data rows
    salesReps.forEach(rep => {
        const avgDeal = rep.deals > 0 ? rep.revenue / rep.deals : 0;
        const lastDeal = rep.dealHistory.length > 0
            ? new Date(rep.dealHistory[rep.dealHistory.length - 1].date).toLocaleDateString()
            : 'N/A';

        csv += `"${rep.name}",${rep.deals},${rep.revenue},${avgDeal.toFixed(2)},"${lastDeal}"\n`;
    });

    // Add detailed deal history
    csv += '\n\nDetailed Deal History\n';
    csv += 'Sales Rep,Date,Amount\n';

    salesReps.forEach(rep => {
        rep.dealHistory.forEach(deal => {
            const date = new Date(deal.date).toLocaleString();
            csv += `"${rep.name}","${date}",${deal.amount}\n`;
        });
    });

    // Download the file
    downloadFile(csv, 'sales-data.csv', 'text/csv');
    console.log('📥 Exported data to CSV');
}

function exportToJSON() {
    if (salesReps.length === 0) {
        alert('No data to export!');
        return;
    }

    const data = {
        exportDate: new Date().toISOString(),
        totalReps: salesReps.length,
        totalDeals: salesReps.reduce((sum, rep) => sum + rep.deals, 0),
        totalRevenue: salesReps.reduce((sum, rep) => sum + rep.revenue, 0),
        salesReps: salesReps
    };

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, 'sales-data-backup.json', 'application/json');
    console.log('📥 Exported data to JSON');
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}