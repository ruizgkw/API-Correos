const API_BASE = '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    initAdminApp();
});

function initAdminApp() {
    const adminToken = localStorage.getItem('admin_access_token');
    const adminUsername = localStorage.getItem('admin_username');

    if (adminToken && adminUsername) {
        showDashboard(adminUsername);
        loadMailAccounts();
    } else {
        showAdminAuth();
    }

    setupAdminEventListeners();
}

function setupAdminEventListeners() {
    // Paso 1: Usuario/Password
    document.getElementById('adminPassForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('adminUsername').value;
        const pass = document.getElementById('adminPassword').value;
        await adminLoginPass(user, pass);
    });

    // Paso 2: 2FA Telegram Code
    document.getElementById('admin2FAForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('adminUsername').value;
        const code = document.getElementById('admin2FACode').value;
        await adminVerify2FA(user, code);
    });

    // Logout Admin
    document.getElementById('adminLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_username');
        location.reload();
    });

    // Modal Agregar Cuenta
    document.getElementById('btnOpenAddMailModal').addEventListener('click', () => {
        document.getElementById('addMailModal').classList.remove('hidden');
    });
    document.getElementById('btnCloseModal').addEventListener('click', () => {
        document.getElementById('addMailModal').classList.add('hidden');
    });

    // Form Guardar Cuenta
    document.getElementById('addMailForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createMailAccount();
    });
}

function showAdminAuth() {
    document.getElementById('adminAuthSection').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('adminBadge').classList.add('hidden');
}

function showDashboard(username) {
    document.getElementById('adminAuthSection').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminBadge').classList.remove('hidden');
    document.getElementById('adminUserSpan').innerText = `Admin: ${username}`;
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
            showDashboard(username);
            loadMailAccounts();
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
    const token = localStorage.getItem('admin_access_token');

    try {
        const res = await fetch(`${API_BASE}/admin/mail-accounts`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const accounts = await res.json();

        tbody.innerHTML = '';
        if (!accounts || accounts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-ghMuted">No hay cuentas de correo registradas.</td></tr>`;
            return;
        }

        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-ghBg/50 transition';
            tr.innerHTML = `
                <td class="p-4 font-mono font-semibold text-white">${acc.email}</td>
                <td class="p-4"><span class="px-2 py-0.5 rounded bg-ghBg border border-ghBorder text-xs text-ghBlue font-mono">${acc.provider}</span></td>
                <td class="p-4 font-mono text-ghMuted">${acc.imap_server}:${acc.imap_port}</td>
                <td class="p-4"><span class="px-2 py-0.5 rounded-full text-xs bg-green-950 text-green-400 border border-green-800/50">Activa</span></td>
                <td class="p-4 text-right">
                    <button onclick="testConnection('${acc.id}', this)" class="px-3 py-1.5 bg-ghBg hover:bg-ghBorder text-ghBlue text-xs rounded border border-ghBorder transition">
                        ⚡ Probar IMAP
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-400">Error cargando cuentas.</td></tr>`;
    }
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
            btnElement.className = 'px-3 py-1.5 bg-green-950 text-green-400 text-xs rounded border border-green-800/50';
            btnElement.innerText = '✓ Login IMAP OK';
        } else {
            btnElement.className = 'px-3 py-1.5 bg-red-950 text-red-400 text-xs rounded border border-red-800/50';
            btnElement.innerText = '✕ Error Login';
        }
    } catch (err) {
        btnElement.innerText = '✕ Error Red';
    } finally {
        setTimeout(() => {
            btnElement.disabled = false;
            btnElement.className = 'px-3 py-1.5 bg-ghBg hover:bg-ghBorder text-ghBlue text-xs rounded border border-ghBorder transition';
            btnElement.innerText = origText;
        }, 3000);
    }
}

async function createMailAccount() {
    const token = localStorage.getItem('admin_access_token');
    const body = {
        email: document.getElementById('modalEmail').value,
        provider: document.getElementById('modalProvider').value,
        auth_type: document.getElementById('modalAuthType').value,
        password_or_token: document.getElementById('modalPassword').value,
        imap_server: document.getElementById('modalImapServer').value,
        imap_port: parseInt(document.getElementById('modalImapPort').value)
    };

    try {
        const res = await fetch(`${API_BASE}/admin/mail-accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            document.getElementById('addMailModal').classList.add('hidden');
            document.getElementById('addMailForm').reset();
            loadMailAccounts();
        } else {
            const errData = await res.json();
            alert(`Error: ${errData.detail || 'No se pudo guardar la cuenta.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

function showAdminAlert(elementId, msg, type) {
    const el = document.getElementById(elementId);
    el.innerText = msg;
    el.classList.remove('hidden', 'bg-red-950/50', 'text-red-400', 'bg-green-950/50', 'text-green-400');
    if (type === 'error') {
        el.classList.add('bg-red-950/50', 'text-red-400', 'border', 'border-red-800/50');
    } else if (type === 'success') {
        el.classList.add('bg-green-950/50', 'text-green-400', 'border', 'border-green-800/50');
    }
}
