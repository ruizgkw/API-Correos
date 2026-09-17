const API_BASE = '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    initAdminApp();
});

function initAdminApp() {
    checkAdminSession();
    setupAdminEventListeners();
}

let cachedMailAccounts = [];
let cachedClients = [];
let deleteActionCallback = null;

function checkAdminSession() {
    const token = localStorage.getItem('admin_access_token');
    const username = localStorage.getItem('admin_username');

    if (token && username) {
        if (document.getElementById('adminDashboard')) {
            showDashboard(username);
            loadMailAccounts();
            loadClients();
            loadAdminProfile();
        } else {
            // Si estamos en la landing index.html y el admin ya tiene sesión activa, redirigir a /admin
            window.location.href = '/admin';
        }
    } else {
        if (document.getElementById('adminAuthSection')) {
            showAdminAuth();
        }
    }
}

function setupAdminEventListeners() {
    // Pestañas Iniciar Sesión / Registro (Auth)
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const passForm = document.getElementById('adminPassForm');
    const regForm = document.getElementById('adminRegisterForm');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.className = 'flex-1 py-2 text-center text-brandAccent border-b-2 border-brandAccent font-semibold';
            tabRegister.className = 'flex-1 py-2 text-center text-brandMuted hover:text-white';
            if (passForm) passForm.classList.remove('hidden');
            if (regForm) regForm.classList.add('hidden');
            const alertEl = document.getElementById('adminAuthAlert');
            if (alertEl) alertEl.classList.add('hidden');
        });
        tabRegister.addEventListener('click', () => {
            tabRegister.className = 'flex-1 py-2 text-center text-brandAccent border-b-2 border-brandAccent font-semibold';
            tabLogin.className = 'flex-1 py-2 text-center text-brandMuted hover:text-white';
            if (regForm) regForm.classList.remove('hidden');
            if (passForm) passForm.classList.add('hidden');
            const form2FA = document.getElementById('admin2FAForm');
            if (form2FA) form2FA.classList.add('hidden');
            const alertEl = document.getElementById('adminAuthAlert');
            if (alertEl) alertEl.classList.add('hidden');
        });
    }

    // Formulario Registro Admin
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const telegramId = document.getElementById('regTelegramId').value;
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            const licenseKey = document.getElementById('regLicenseKey').value;
            await registerAdmin(telegramId, username, password, licenseKey);
        });
    }

    // Paso 1: Usuario/Password
    if (passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('adminUsername').value;
            const pass = document.getElementById('adminPassword').value;
            await adminLoginPass(user, pass);
        });
    }

    // Paso 2: 2FA Telegram Code
    const form2FA = document.getElementById('admin2FAForm');
    if (form2FA) {
        form2FA.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('adminUsername').value;
            const code = document.getElementById('admin2FACode').value;
            await adminVerify2FA(user, code);
        });
    }

    // Logout Admin
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_username');
            location.reload();
        });
    }

    // Tabs del Dashboard de Administración
    const dTabMails = document.getElementById('dashboardTabMails');
    if (dTabMails) dTabMails.addEventListener('click', () => switchDashboardTab('mails'));

    const dTabClients = document.getElementById('dashboardTabClients');
    if (dTabClients) dTabClients.addEventListener('click', () => switchDashboardTab('clients'));

    const dTabProfile = document.getElementById('dashboardTabProfile');
    if (dTabProfile) dTabProfile.addEventListener('click', () => switchDashboardTab('profile'));

    // Buscador en tiempo real de Correos
    const searchMails = document.getElementById('searchMailsInput');
    if (searchMails) searchMails.addEventListener('input', filterMailAccounts);

    // Buscador en tiempo real de Clientes
    const searchClients = document.getElementById('searchClientsInput');
    if (searchClients) searchClients.addEventListener('input', filterClients);

    // Modal de confirmación de eliminación
    const cancelDelBtn = document.getElementById('btnCancelDelete');
    if (cancelDelBtn) cancelDelBtn.addEventListener('click', closeDeleteModal);

    const confirmDelBtn = document.getElementById('btnConfirmDelete');
    if (confirmDelBtn) {
        confirmDelBtn.addEventListener('click', async () => {
            if (deleteActionCallback) {
                confirmDelBtn.disabled = true;
                confirmDelBtn.innerText = 'Eliminando...';
                try {
                    await deleteActionCallback();
                } finally {
                    confirmDelBtn.disabled = false;
                    confirmDelBtn.innerText = '🗑️ Sí, Eliminar';
                    closeDeleteModal();
                }
            }
        });
    }

    // Modal Agregar Cuenta
    const btnOpenAddMail = document.getElementById('btnOpenAddMailModal');
    if (btnOpenAddMail) {
        btnOpenAddMail.addEventListener('click', () => {
            const modal = document.getElementById('addMailModal');
            if (modal) modal.classList.remove('hidden');
        });
    }
    const btnCloseModal = document.getElementById('btnCloseModal');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            const modal = document.getElementById('addMailModal');
            if (modal) modal.classList.add('hidden');
        });
    }

    // Form Guardar Cuenta (Crear o Editar)
    const addMailForm = document.getElementById('addMailForm');
    if (addMailForm) {
        addMailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createOrUpdateMailAccount();
        });
    }

    // Form Guardar Cliente VIP (Crear o Editar)
    const authClientForm = document.getElementById('authorizeClientForm');
    if (authClientForm) {
        authClientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('authClientFullName').value;
            const chatId = document.getElementById('authClientChatId').value;
            const approved = document.getElementById('authClientApproved').value === 'true';
            await saveClientAuthorization(chatId, fullName, approved);
            closeAuthorizeClientModal();
        });
    }

    // Formularios de Cambio de Credenciales Admin
    const credForm = document.getElementById('changeCredentialsForm');
    if (credForm) credForm.addEventListener('submit', handleRequestCredChange);

    const verifyCredForm = document.getElementById('verifyCredChangeForm');
    if (verifyCredForm) verifyCredForm.addEventListener('submit', handleVerifyCredChange);

    const cancelCredBtn = document.getElementById('btnCancelCredChange');
    if (cancelCredBtn) {
        cancelCredBtn.addEventListener('click', () => {
            document.getElementById('verifyCredChangeForm').classList.add('hidden');
            document.getElementById('changeCredentialsForm').classList.remove('hidden');
            const alertEl = document.getElementById('profileAlert');
            if (alertEl) alertEl.classList.add('hidden');
        });
    }
}

function showAdminAuth() {
    const authSec = document.getElementById('adminAuthSection');
    if (authSec) authSec.classList.remove('hidden');
    const dash = document.getElementById('adminDashboard');
    if (dash) dash.classList.add('hidden');
    const badge = document.getElementById('adminBadge');
    if (badge) badge.classList.add('hidden');
    const backBtn = document.getElementById('adminBackBtn');
    if (backBtn) backBtn.classList.remove('hidden');
}

function showDashboard(username) {
    const authSec = document.getElementById('adminAuthSection');
    if (authSec) authSec.classList.add('hidden');
    const dash = document.getElementById('adminDashboard');
    if (dash) dash.classList.remove('hidden');
    const badge = document.getElementById('adminBadge');
    if (badge) badge.classList.remove('hidden');
    const userSpan = document.getElementById('adminUserSpan');
    if (userSpan) userSpan.innerText = `Admin: ${username}`;
    const backBtn = document.getElementById('adminBackBtn');
    if (backBtn) backBtn.classList.add('hidden');
}

async function registerAdmin(telegramChatId, username, password, licenseKey) {
    const btn = document.getElementById('btnAdminRegister');
    btn.disabled = true;
    btn.innerText = 'Registrando...';

    try {
        const res = await fetch(`${API_BASE}/admin/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_chat_id: parseInt(telegramChatId),
                username: username,
                password: password,
                license_key: licenseKey
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showAdminAlert('adminAuthAlert', 'Administrador creado con éxito. Ahora puedes Iniciar Sesión.', 'success');
            document.getElementById('tabLogin').click();
            document.getElementById('adminUsername').value = username;
        } else {
            showAdminAlert('adminAuthAlert', data.detail || 'Error al registrar administrador.', 'error');
        }
    } catch (err) {
        showAdminAlert('adminAuthAlert', 'Error de conexión con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Crear Administrador';
    }
}

async function adminLoginPass(username, password) {

    const btn = document.getElementById('btnAdminPass');
    btn.disabled = true;
    btn.innerText = 'Validando...';

    try {
        const res = await fetch(`${API_BASE}/admin/auth/login-pass`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            document.getElementById('adminPassForm').classList.add('hidden');
            document.getElementById('admin2FAForm').classList.remove('hidden');
            showAdminAlert('adminAuthAlert', 'Contraseña correcta. Ingresa el código 2FA enviado a Telegram.', 'success');
        } else {
            showAdminAlert('adminAuthAlert', data.detail || 'Usuario o Contraseña incorrectos.', 'error');
        }
    } catch (err) {
        showAdminAlert('adminAuthAlert', 'Error de conexión con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Validar Contraseña';
    }
}

async function adminVerify2FA(username, otpCode) {
    const btn = document.getElementById('btnAdmin2FA');
    btn.disabled = true;
    btn.innerText = 'Ingresando...';

    try {
        const res = await fetch(`${API_BASE}/admin/auth/verify-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, otp_code: otpCode })
        });
        const data = await res.json();

        if (res.ok && data.access_token) {
            localStorage.setItem('admin_access_token', data.access_token);
            localStorage.setItem('admin_username', username);
            if (document.getElementById('adminDashboard')) {
                showDashboard(username);
                loadMailAccounts();
                loadClients();
            } else {
                window.location.href = '/admin';
            }
        } else {
            showAdminAlert('adminAuthAlert', data.detail || 'Código 2FA incorrecto o expirado.', 'error');
        }
    } catch (err) {
        showAdminAlert('adminAuthAlert', 'Error al verificar 2FA.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Ingresar al Panel';
    }
}

async function loadMailAccounts() {
    const tbody = document.getElementById('mailAccountsTableBody');
    if (!tbody) return;
    const token = localStorage.getItem('admin_access_token');

    try {
        const res = await fetch(`${API_BASE}/admin/mail-accounts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-400">Error al cargar cuentas de correo.</td></tr>`;
            return;
        }
        cachedMailAccounts = await res.json() || [];
        const countBadge = document.getElementById('mailAccountsCountBadge');
        if (countBadge) countBadge.innerText = cachedMailAccounts.length;

        filterMailAccounts();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-400">Error de conexión al cargar cuentas.</td></tr>`;
    }
}

function filterMailAccounts() {
    const input = document.getElementById('searchMailsInput');
    const query = input ? input.value.toLowerCase().trim() : '';

    const filtered = cachedMailAccounts.filter(acc => {
        const email = (acc.email || '').toLowerCase();
        const provider = (acc.provider || '').toLowerCase();
        const server = (acc.imap_server || '').toLowerCase();
        return email.includes(query) || provider.includes(query) || server.includes(query);
    });

    const countLabel = document.getElementById('searchMailsCount');
    if (countLabel) {
        countLabel.innerText = query ? `${filtered.length} de ${cachedMailAccounts.length}` : `${cachedMailAccounts.length} en total`;
    }

    renderMailAccounts(filtered);
}

function renderMailAccounts(accounts) {
    const tbody = document.getElementById('mailAccountsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!accounts || accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-brandMuted">No se encontraron cuentas de correo.</td></tr>`;
        return;
    }

    accounts.forEach(acc => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-brandBg/50 transition';
        tr.innerHTML = `
            <td class="p-4 font-mono font-semibold text-white">${acc.email}</td>
            <td class="p-4"><span class="px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-800/50 text-xs text-brandAccent font-mono">${acc.provider}</span></td>
            <td class="p-4 font-mono text-brandMuted">${acc.imap_server}:${acc.imap_port}</td>
            <td class="p-4"><span class="px-2.5 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50">Activa</span></td>
            <td class="p-4 text-right space-x-1.5 whitespace-nowrap">
                <button onclick="openEditModal('${acc.id}', '${acc.email}', '${acc.provider}', '${acc.auth_type}', '${acc.imap_server}', ${acc.imap_port})" class="px-2.5 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition cursor-pointer">
                    ✏️ Editar
                </button>
                <button onclick="testConnection('${acc.id}', this)" class="px-2.5 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition cursor-pointer">
                    ⚡ Probar
                </button>
                <button onclick="confirmDeleteMailAccount('${acc.id}', '${acc.email}')" class="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs rounded-xl border border-rose-800/50 transition cursor-pointer">
                    🗑️ Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function switchDashboardTab(tabName) {
    const tabMails = document.getElementById('dashboardTabMails');
    const tabClients = document.getElementById('dashboardTabClients');
    const tabProfile = document.getElementById('dashboardTabProfile');

    const secMails = document.getElementById('sectionMails');
    const secClients = document.getElementById('sectionClients');
    const secProfile = document.getElementById('sectionProfile');

    const activeTabClass = 'border-b-2 border-brandAccent text-brandAccent font-semibold';
    const inactiveTabClass = 'border-b-2 border-transparent text-brandMuted hover:text-white';

    if (secMails) secMails.classList.add('hidden');
    if (secClients) secClients.classList.add('hidden');
    if (secProfile) secProfile.classList.add('hidden');

    if (tabMails) tabMails.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${inactiveTabClass}`;
    if (tabClients) tabClients.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${inactiveTabClass}`;
    if (tabProfile) tabProfile.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${inactiveTabClass}`;

    if (tabName === 'mails') {
        if (secMails) secMails.classList.remove('hidden');
        if (tabMails) tabMails.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${activeTabClass}`;
    } else if (tabName === 'clients') {
        if (secClients) secClients.classList.remove('hidden');
        if (tabClients) tabClients.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${activeTabClass}`;
    } else if (tabName === 'profile') {
        if (secProfile) secProfile.classList.remove('hidden');
        if (tabProfile) tabProfile.className = `py-4 px-2 text-xs transition flex items-center space-x-2 cursor-pointer ${activeTabClass}`;
    }
}

function openEditModal(id, email, provider, authType, imapServer, imapPort) {
    document.getElementById('modalTitle').innerText = 'Editar Cuenta de Correo';
    document.getElementById('modalAccountId').value = id;
    document.getElementById('modalEmail').value = email;
    document.getElementById('modalEmail').disabled = true;
    document.getElementById('modalProvider').value = provider;
    document.getElementById('modalAuthType').value = authType;
    document.getElementById('modalPassword').value = '';
    document.getElementById('modalPassword').placeholder = 'Dejar vacío si no deseas cambiar la clave';
    document.getElementById('modalPassword').required = false;
    document.getElementById('modalImapServer').value = imapServer;
    document.getElementById('modalImapPort').value = imapPort;

    document.getElementById('addMailModal').classList.remove('hidden');
}

async function testConnection(accountId, btnElement) {
    const token = localStorage.getItem('admin_access_token');
    const origText = btnElement.innerText;
    btnElement.disabled = true;
    btnElement.innerText = 'Probando...';

    try {
        const res = await fetch(`${API_BASE}/admin/mail-accounts/${accountId}/test-connection`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.success) {
            btnElement.className = 'px-2.5 py-1.5 bg-emerald-950 text-emerald-400 text-xs rounded-xl border border-emerald-800/50';
            btnElement.innerText = '✓ Login OK';
        } else {
            btnElement.className = 'px-2.5 py-1.5 bg-rose-950 text-rose-400 text-xs rounded-xl border border-rose-800/50';
            btnElement.innerText = '✕ Error';
        }
    } catch (err) {
        btnElement.innerText = '✕ Error Red';
    } finally {
        setTimeout(() => {
            btnElement.disabled = false;
            btnElement.className = 'px-2.5 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition cursor-pointer';
            btnElement.innerText = origText;
        }, 3000);
    }
}

async function createOrUpdateMailAccount() {
    const token = localStorage.getItem('admin_access_token');
    const accountId = document.getElementById('modalAccountId').value;

    const email = document.getElementById('modalEmail').value;
    const provider = document.getElementById('modalProvider').value;
    const authType = document.getElementById('modalAuthType').value;
    const pass = document.getElementById('modalPassword').value;
    const imapServer = document.getElementById('modalImapServer').value;
    const imapPort = parseInt(document.getElementById('modalImapPort').value);

    let url = `${API_BASE}/admin/mail-accounts`;
    let method = 'POST';

    const body = {
        provider: provider,
        auth_type: authType,
        imap_server: imapServer,
        imap_port: imapPort
    };

    if (accountId) {
        url = `${API_BASE}/admin/mail-accounts/${accountId}`;
        method = 'PUT';
        if (pass) {
            body.password_or_token = pass;
        }
    } else {
        body.email = email;
        body.password_or_token = pass;
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            document.getElementById('addMailModal').classList.add('hidden');
            document.getElementById('addMailForm').reset();
            document.getElementById('modalAccountId').value = '';
            document.getElementById('modalEmail').disabled = false;
            document.getElementById('modalPassword').required = true;
            await loadMailAccounts();
        } else {
            const errData = await res.json();
            alert(`Error: ${errData.detail || 'No se pudo guardar la cuenta.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

function confirmDeleteMailAccount(id, email) {
    openDeleteModal(
        'Eliminar Cuenta de Correo',
        `¿Estás seguro de que deseas eliminar permanentemente la cuenta <strong class="text-white">${email}</strong>? Se borrarán sus credenciales y el rastreo de correos asociados.`,
        async () => {
            await deleteMailAccount(id);
        }
    );
}

async function deleteMailAccount(id) {
    const token = localStorage.getItem('admin_access_token');
    try {
        const res = await fetch(`${API_BASE}/admin/mail-accounts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            await loadMailAccounts();
        } else {
            const data = await res.json();
            alert(`Error: ${data.detail || 'No se pudo eliminar la cuenta.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

function showAdminAlert(elementId, msg, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerText = msg;
    el.classList.remove('hidden', 'bg-rose-950/50', 'text-rose-400', 'border-rose-800/50', 'bg-emerald-950/50', 'text-emerald-400', 'border-emerald-800/50');
    if (type === 'error') {
        el.classList.add('bg-rose-950/50', 'text-rose-400', 'border', 'border-rose-800/50');
    } else if (type === 'success') {
        el.classList.add('bg-emerald-950/50', 'text-emerald-400', 'border', 'border-emerald-800/50');
    }
}

async function connectOAuth(provider) {
    try {
        const res = await fetch(`${API_BASE}/admin/oauth/authorize?provider=${provider}`);
        const data = await res.json();
        if (res.ok && data.auth_url) {
            const width = 600, height = 700;
            const left = (window.innerWidth - width) / 2;
            const top = (window.innerHeight - height) / 2;
            const popup = window.open(
                data.auth_url,
                `Conectar con ${provider}`,
                `width=${width},height=${height},top=${top},left=${left}`
            );

            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    loadMailAccounts();
                }
            }, 1000);
        } else {
            alert(data.detail || 'Error iniciando OAuth2.');
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

// --- Funciones de Gestión de Lista Blanca de Clientes VIP ---

async function loadClients() {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    const token = localStorage.getItem('admin_access_token');

    try {
        const res = await fetch(`${API_BASE}/admin/clients`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-rose-400">Error al cargar clientes.</td></tr>`;
            return;
        }
        cachedClients = await res.json() || [];
        const countBadge = document.getElementById('clientsCountBadge');
        if (countBadge) countBadge.innerText = cachedClients.length;

        filterClients();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-rose-400">Error de conexión al cargar clientes.</td></tr>`;
    }
}

function filterClients() {
    const input = document.getElementById('searchClientsInput');
    const query = input ? input.value.toLowerCase().trim() : '';

    const filtered = cachedClients.filter(c => {
        const chatId = String(c.telegram_chat_id || '').toLowerCase();
        const fullName = (c.full_name || '').toLowerCase();
        return chatId.includes(query) || fullName.includes(query);
    });

    const countLabel = document.getElementById('searchClientsCount');
    if (countLabel) {
        countLabel.innerText = query ? `${filtered.length} de ${cachedClients.length}` : `${cachedClients.length} en total`;
    }

    renderClients(filtered);
}

function renderClients(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!clients || clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-brandMuted">No hay clientes autorizados en la lista blanca.</td></tr>`;
        return;
    }

    clients.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-brandBg/50 transition';
        const statusBadge = client.is_approved
            ? `<span class="px-2.5 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50">✓ Autorizado VIP</span>`
            : `<span class="px-2.5 py-0.5 rounded-full text-xs bg-rose-950 text-rose-400 border border-rose-800/50">✕ Revocado</span>`;

        const dateStr = client.created_at ? new Date(client.created_at).toLocaleDateString() : '--';
        const displayName = client.full_name ? client.full_name : '<span class="text-brandMuted italic">Sin nombre</span>';
        const escapedName = (client.full_name || '').replace(/'/g, "\\'");

        tr.innerHTML = `
            <td class="p-4 font-semibold text-white">${displayName}</td>
            <td class="p-4 font-mono font-bold text-brandAccent">${client.telegram_chat_id}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 font-mono text-brandMuted text-xs">${dateStr}</td>
            <td class="p-4 text-right space-x-1.5 whitespace-nowrap">
                <button onclick="openEditClientModal(${client.telegram_chat_id}, '${escapedName}', ${client.is_approved})" class="px-2.5 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition cursor-pointer">
                    ✏️ Editar
                </button>
                <button onclick="toggleClientApproval(${client.telegram_chat_id}, ${!client.is_approved})" class="px-2.5 py-1.5 ${client.is_approved ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border-amber-800/50' : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50'} text-xs rounded-xl border transition font-medium cursor-pointer">
                    ${client.is_approved ? '🚫 Revocar' : '✅ Autorizar'}
                </button>
                <button onclick="confirmDeleteClient(${client.telegram_chat_id}, '${escapedName || client.telegram_chat_id}')" class="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs rounded-xl border border-rose-800/50 transition cursor-pointer">
                    🗑️ Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openAuthorizeClientModal() {
    const title = document.getElementById('authClientModalTitle');
    if (title) title.innerText = 'Autorizar Nuevo Cliente VIP';
    const fullNameInput = document.getElementById('authClientFullName');
    if (fullNameInput) fullNameInput.value = '';
    const chatIdInput = document.getElementById('authClientChatId');
    if (chatIdInput) {
        chatIdInput.value = '';
        chatIdInput.disabled = false;
    }
    const approvedSelect = document.getElementById('authClientApproved');
    if (approvedSelect) approvedSelect.value = 'true';

    const modal = document.getElementById('authorizeClientModal');
    if (modal) modal.classList.remove('hidden');
}

function openEditClientModal(chatId, fullName, isApproved) {
    const title = document.getElementById('authClientModalTitle');
    if (title) title.innerText = 'Editar Cliente VIP';
    const fullNameInput = document.getElementById('authClientFullName');
    if (fullNameInput) fullNameInput.value = fullName || '';
    const chatIdInput = document.getElementById('authClientChatId');
    if (chatIdInput) {
        chatIdInput.value = chatId;
        chatIdInput.disabled = true;
    }
    const approvedSelect = document.getElementById('authClientApproved');
    if (approvedSelect) approvedSelect.value = isApproved ? 'true' : 'false';

    const modal = document.getElementById('authorizeClientModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAuthorizeClientModal() {
    const modal = document.getElementById('authorizeClientModal');
    if (modal) modal.classList.add('hidden');
}

async function saveClientAuthorization(chatId, fullName, approveState) {
    const token = localStorage.getItem('admin_access_token');
    try {
        const res = await fetch(`${API_BASE}/admin/clients/authorize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                telegram_chat_id: parseInt(chatId),
                full_name: fullName ? fullName.trim() : null,
                is_approved: approveState
            })
        });

        if (res.ok) {
            await loadClients();
        } else {
            const data = await res.json();
            alert(`Error: ${data.detail || 'No se pudo guardar el cliente.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

async function toggleClientApproval(chatId, approveState) {
    const client = cachedClients.find(c => c.telegram_chat_id === parseInt(chatId));
    const fullName = client ? client.full_name : null;
    await saveClientAuthorization(chatId, fullName, approveState);
}

function confirmDeleteClient(chatId, displayName) {
    openDeleteModal(
        'Eliminar Cliente VIP',
        `¿Estás seguro de que deseas eliminar permanentemente al cliente <strong class="text-white">${displayName}</strong> (Chat ID: ${chatId})? Perderá acceso inmediato a la API de correos.`,
        async () => {
            await deleteClient(chatId);
        }
    );
}

async function deleteClient(chatId) {
    const token = localStorage.getItem('admin_access_token');
    try {
        const res = await fetch(`${API_BASE}/admin/clients/${chatId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            await loadClients();
        } else {
            const data = await res.json();
            alert(`Error: ${data.detail || 'No se pudo eliminar el cliente.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

// --- Modal de Confirmación de Eliminación ---

function openDeleteModal(title, message, onConfirm) {
    const modal = document.getElementById('deleteConfirmModal');
    const titleEl = document.getElementById('deleteModalTitle');
    const msgEl = document.getElementById('deleteModalMessage');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerHTML = message;
    deleteActionCallback = onConfirm;
    if (modal) modal.classList.remove('hidden');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.classList.add('hidden');
    deleteActionCallback = null;
}

// --- Perfil y Seguridad del Administrador ---

async function loadAdminProfile() {
    const userSpan = document.getElementById('profileCurrentUsername');
    const chatSpan = document.getElementById('profileCurrentChatId');
    if (!userSpan && !chatSpan) return;

    const token = localStorage.getItem('admin_access_token');
    try {
        const res = await fetch(`${API_BASE}/admin/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const profile = await res.json();
            if (userSpan) userSpan.innerText = profile.username;
            if (chatSpan) chatSpan.innerText = profile.telegram_chat_id;
        }
    } catch (err) {
        console.error('Error al cargar perfil de admin:', err);
    }
}

async function handleRequestCredChange(e) {
    e.preventDefault();
    const curPass = document.getElementById('changeCurrentPassword').value;
    const newUsername = document.getElementById('changeNewUsername').value.trim();
    const newPassword = document.getElementById('changeNewPassword').value;

    if (!newUsername && !newPassword) {
        showAdminAlert('profileAlert', 'Debes ingresar un nuevo usuario o una nueva contraseña para actualizar.', 'error');
        return;
    }

    const btn = document.getElementById('btnRequestCredChange');
    btn.disabled = true;
    btn.innerText = 'Enviando 2FA a Telegram...';

    const token = localStorage.getItem('admin_access_token');
    try {
        const payload = {
            current_password: curPass
        };
        if (newUsername) payload.new_username = newUsername;
        if (newPassword) payload.new_password = newPassword;

        const res = await fetch(`${API_BASE}/admin/profile/change-credentials-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
            document.getElementById('changeCredentialsForm').classList.add('hidden');
            document.getElementById('verifyCredChangeForm').classList.remove('hidden');
            showAdminAlert('profileAlert', 'Código de verificación 2FA enviado a tu Telegram. Ingrésalo a continuación.', 'success');
        } else {
            showAdminAlert('profileAlert', data.detail || 'Error al solicitar cambio de credenciales.', 'error');
        }
    } catch (err) {
        showAdminAlert('profileAlert', 'Error de conexión con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = '🚀 Solicitar Código 2FA en Telegram';
    }
}

async function handleVerifyCredChange(e) {
    e.preventDefault();
    const otpCode = document.getElementById('changeOtpCode').value.trim();
    const btn = document.getElementById('btnVerifyCredChange');
    btn.disabled = true;
    btn.innerText = 'Confirmando...';

    const token = localStorage.getItem('admin_access_token');
    try {
        const res = await fetch(`${API_BASE}/admin/profile/change-credentials-verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ otp_code: otpCode })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showAdminAlert('profileAlert', '¡Credenciales actualizadas exitosamente! Redirigiendo...', 'success');
            if (data.new_username) {
                localStorage.setItem('admin_username', data.new_username);
            }
            setTimeout(() => {
                location.reload();
            }, 1800);
        } else {
            showAdminAlert('profileAlert', data.detail || 'Código 2FA incorrecto o expirado.', 'error');
        }
    } catch (err) {
        showAdminAlert('profileAlert', 'Error de conexión con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Confirmar y Aplicar Cambios';
    }
}


