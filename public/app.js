const API_BASE = '/api';

// --- State ---
let currentSites = [];
let currentSiteConfig = '';
let activeMode = 'static'; // Changed default to static

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    loadSites();
    // Poll status every 10s
    setInterval(updateStatus, 10000);
});

// --- API calls ---
async function updateStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();

        const dot = document.getElementById('nginxDot');
        const text = document.getElementById('nginxText');

        if (data.nginx) {
            dot.className = 'w-3 h-3 rounded-full bg-green-500 mr-2';
            text.className = 'text-green-600 font-bold';
            text.textContent = 'Active';
        } else {
            dot.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
            text.className = 'text-red-600 font-bold';
            text.textContent = 'Inactive';
        }
    } catch (err) {
        console.error('Failed to fetch status', err);
    }
}

async function controlService(action) {
    try {
        const btn = event.target.closest('button');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Wait';
        btn.disabled = true;

        const res = await fetch(`${API_BASE}/service/${action}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
            showAlert(data.error + (data.details ? ': ' + data.details : ''), 'error');
        } else {
            showAlert(data.message, 'success');
        }

        await updateStatus();

        btn.innerHTML = originalHtml;
        btn.disabled = false;
    } catch (err) {
        showAlert('Failed to connect to server', 'error');
    }
}

async function loadSites() {
    try {
        const listEl = document.getElementById('siteList');
        const res = await fetch(`${API_BASE}/sites`);
        currentSites = await res.json();

        listEl.innerHTML = '';

        if (currentSites.length === 0) {
            listEl.innerHTML = '<li class="text-center text-gray-500 py-4">No sites found in available directory.</li>';
            return;
        }

        currentSites.forEach(site => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 hover:bg-gray-50 border rounded transition cursor-pointer';

            const badgeClass = site.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
            const badgeText = site.enabled ? 'Enabled' : 'Disabled';
            const toggleIcon = site.enabled ? 'fa-toggle-on text-green-500' : 'fa-toggle-off text-gray-400';

            li.innerHTML = `
                <div class="flex-1 overflow-hidden" onclick="loadSiteConfig('${site.name}')">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-file-alt text-gray-400"></i>
                        <span class="font-medium text-gray-800 truncate">${site.name}</span>
                    </div>
                </div>
                <div class="flex items-center space-x-3 ml-2">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">${badgeText}</span>
                    <button onclick="toggleSite('${site.name}', ${!site.enabled})" class="focus:outline-none" title="Toggle site status">
                        <i class="fas ${toggleIcon} fa-lg"></i>
                    </button>
                </div>
            `;
            listEl.appendChild(li);
        });
    } catch (err) {
        document.getElementById('siteList').innerHTML = '<li class="text-center text-red-500 py-4"><i class="fas fa-exclamation-triangle mr-2"></i>Failed to load sites</li>';
    }
}

async function toggleSite(name, enable) {
    try {
        const res = await fetch(`${API_BASE}/sites/${name}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable })
        });

        const data = await res.json();
        if (!res.ok) {
            showAlert(data.error + (data.details ? ': \n' + data.details : ''), 'error');
        } else {
            showAlert(data.message, 'success');
            loadSites(); // refresh list
        }
    } catch (err) {
        showAlert('Failed to connect to server', 'error');
    }
}

async function loadSiteConfig(name) {
    try {
        const res = await fetch(`${API_BASE}/sites/${name}`);
        const data = await res.json();

        if (res.ok) {
            currentSiteConfig = data.content;

            // Show editor, hide empty state
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('editorView').classList.remove('hidden');

            // Populate form
            document.getElementById('editorTitle').textContent = `Editing: ${name}`;
            document.getElementById('siteNameOriginal').value = name;
            document.getElementById('siteName').value = name;
            document.getElementById('isEditing').value = 'true';
            document.getElementById('siteName').disabled = true; // Don't allow rename for now

            // For editing, force Raw mode to ensure we don't mess up existing complex configs
            switchMode('raw');
            document.getElementById('rawConfig').value = currentSiteConfig;

            // Try to extract listen port to build the visit URL
            let portMatch = currentSiteConfig.match(/listen\s+(\d+)/);
            let visitPort = portMatch ? portMatch[1] : '80';

            const visitLink = document.getElementById('siteVisitLink');
            visitLink.href = `http://localhost:${visitPort}`;
            visitLink.classList.remove('hidden');

            // Hide delete btn if it's the default site maybe? Or just leave it.
            document.getElementById('deleteBtn').classList.remove('hidden');

            hideAlert();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (err) {
        showAlert('Failed to load config', 'error');
    }
}

// --- UI Interactions ---

function showCreateForm() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('editorView').classList.remove('hidden');

    document.getElementById('editorTitle').textContent = 'Create New Site';
    document.getElementById('siteNameOriginal').value = '';
    document.getElementById('siteName').value = '';
    document.getElementById('isEditing').value = 'false';
    document.getElementById('siteName').disabled = false;

    document.getElementById('listenPort').value = '80';
    document.getElementById('proxyPort').value = '';
    document.getElementById('phpEnabled').checked = false;
    document.getElementById('rawConfig').value = '';

    document.getElementById('deleteBtn').classList.add('hidden');
    document.getElementById('siteVisitLink').classList.add('hidden');

    // Select proxy radio
    document.querySelector('input[name="mode"][value="static"]').checked = true;
    switchMode('static');
    hideAlert();
}

function switchMode(mode) {
    activeMode = mode;

    const commonFields = document.getElementById('commonFields');
    const proxyFields = document.getElementById('proxyFields');
    const staticFields = document.getElementById('staticFields');
    const rawFields = document.getElementById('rawFields');
    const creationModes = document.getElementById('creationModes');

    // Default hiding
    commonFields.classList.add('hidden');
    proxyFields.classList.add('hidden');
    staticFields.classList.add('hidden');
    rawFields.classList.add('hidden');

    if (document.getElementById('isEditing').value === 'true') {
        // When editing, force raw and disable mode switching
        creationModes.classList.add('hidden');
        rawFields.classList.remove('hidden');
    } else {
        creationModes.classList.remove('hidden');

        if (mode === 'proxy') {
            commonFields.classList.remove('hidden');
            proxyFields.classList.remove('hidden');
        } else if (mode === 'static') {
            commonFields.classList.remove('hidden');
            staticFields.classList.remove('hidden');
        } else if (mode === 'raw') {
            rawFields.classList.remove('hidden');
        }
    }
}

async function saveSiteConfig() {
    const isEditing = document.getElementById('isEditing').value === 'true';
    const originalName = document.getElementById('siteNameOriginal').value;
    const baseSiteName = document.getElementById('siteName').value;

    if (!baseSiteName) {
        showAlert('Site name is required', 'error');
        return;
    }

    // append .conf if not present for the filename
    const siteName = baseSiteName.endsWith('.conf') ? baseSiteName : `${baseSiteName}.conf`;
    // domain just uses base site name for placeholder purposes if domain is removed from UI
    const domain = baseSiteName;

    const payload = {
        name: siteName,
        type: activeMode
    };

    if (activeMode === 'proxy') {
        payload.listenPort = document.getElementById('listenPort').value || 80;
        payload.domain = domain;
        payload.port = document.getElementById('proxyPort').value;
        if (!payload.port) {
            showAlert('Proxy Target Port is required for Proxy mode', 'error');
            return;
        }
    } else if (activeMode === 'static') {
        payload.listenPort = document.getElementById('listenPort').value || 80;
        payload.domain = domain;
        payload.rootPath = `/home/yufang/workspace/${baseSiteName}`;
        payload.phpEnabled = document.getElementById('phpEnabled').checked;
    } else if (activeMode === 'raw') {
        payload.content = document.getElementById('rawConfig').value;
        if (!payload.content) {
            showAlert('Configuration content is required', 'error');
            return;
        }
    }

    // Disable btn
    const btn = document.getElementById('saveBtn');
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Saving...';
    btn.disabled = true;

    try {
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${API_BASE}/sites/${originalName}` : `${API_BASE}/sites`;

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            showAlert(data.error + (data.details ? ': \n' + data.details : ''), 'error');
        } else {
            showAlert('Configuration saved successfully!', 'success');
            loadSites();
            // Swap to edit mode if we just created it
            if (!isEditing) {
                setTimeout(() => loadSiteConfig(siteName), 1000);
            }
        }
    } catch (err) {
        showAlert('Failed to connect to server', 'error');
    } finally {
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
}

async function deleteCurrentSite() {
    const name = document.getElementById('siteNameOriginal').value;
    if (!name) return;

    let deleteMsg = `Are you sure you want to delete ${name}?\n\nThis will remove the configuration file permanently and reload Nginx.`;
    const deleteFolder = confirm(deleteMsg + `\n\nDo you ALSO want to delete the web directory in ~/workspace for this site completely? Press OK to delete the directory, or Cancel to just delete the Nginx config.`);

    // If user clicked Cancel, we still might want to just delete the site config without folder
    // But confirm returns false if they cancel both. Let's make it a two step process for clarity.

    // Step 1: Confirm site config deletion
    if (!confirm(`Confirm: Delete Nginx configuration for ${name}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/sites/${name}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteFolder: deleteFolder })
        });
        const data = await res.json();

        if (!res.ok) {
            showAlert(data.error + (data.details ? ': ' + data.details : ''), 'error');
        } else {
            document.getElementById('editorView').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
            loadSites();
        }
    } catch (err) {
        showAlert('Failed to delete site', 'error');
    }
}

// --- Helpers ---
function showAlert(msg, type) {
    const ab = document.getElementById('alertBox');
    const am = document.getElementById('alertMessage');

    ab.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');

    if (type === 'error') {
        ab.classList.add('bg-red-100', 'text-red-800');
        // Simple formatting for raw details output
        am.innerHTML = msg.replace(/\n/g, '<br>');
    } else {
        ab.classList.add('bg-green-100', 'text-green-800');
        am.textContent = msg;
    }
}

function hideAlert() {
    document.getElementById('alertBox').classList.add('hidden');
}