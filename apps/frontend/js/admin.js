const API_BASE = '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    initAdminApp();
});

function initAdminApp() {
    checkAdminSession();
    setupAdminEventListeners();
}

function checkAdminSession() {
    const token = localStorage.getItem('admin_access_token');
    const username = localStorage.getItem('admin_username');

    if (token && username) {
        showDashboard(username);
        loadMailAccounts();
        loadClients();
    } else {
        showAdminAuth();
    }
}

function setupAdminEventListeners() {
    // Pestañas Iniciar Sesión / Registro
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const passForm = document.getElementById('adminPassForm');
    const regForm = document.getElementById('adminRegisterForm');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            tabLogin.className = 'flex-1 py-2 text-center text-ghBlue border-b-2 border-ghBlue font-semibold';
            tabRegister.className = 'flex-1 py-2 text-center text-ghMuted hover:text-white';
            passForm.classList.remove('hidden');
            regForm.classList.add('hidden');
        });
        tabRegister.addEventListener('click', () => {
            tabRegister.className = 'flex-1 py-2 text-center text-ghBlue border-b-2 border-ghBlue font-semibold';
            tabLogin.className = 'flex-1 py-2 text-center text-ghMuted hover:text-white';
            regForm.classList.remove('hidden');
            passForm.classList.add('hidden');
        });
    }

    // Formulario Registro Admin
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const telegramId = document.getElementById('regTelegramId').value;
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            await registerAdmin(telegramId, username, password);
        });
    }

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

    // Form Guardar Cuenta (Crear o Editar)
    document.getElementById('addMailForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createOrUpdateMailAccount();
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

async function registerAdmin(telegramChatId, username, password) {
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
                password: password
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
            showDashboard(username);
            loadMailAccounts();
            loadClients();
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
            tr.className = 'hover:bg-brandBg/50 transition';
            tr.innerHTML = `
                <td class="p-4 font-mono font-semibold text-white">${acc.email}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-800/50 text-xs text-brandAccent font-mono">${acc.provider}</span></td>
                <td class="p-4 font-mono text-brandMuted">${acc.imap_server}:${acc.imap_port}</td>
                <td class="p-4"><span class="px-2.5 py-0.5 rounded-full text-xs bg-green-950 text-green-400 border border-green-800/50">Activa</span></td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="openEditModal('${acc.id}', '${acc.email}', '${acc.provider}', '${acc.auth_type}', '${acc.imap_server}', ${acc.imap_port})" class="px-3 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition">
                        ✏️ Editar
                    </button>
                    <button onclick="testConnection('${acc.id}', this)" class="px-3 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition">
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

function openEditModal(id, email, provider, authType, imapServer, imapPort) {
    document.getElementById('modalTitle').innerText = 'Editar Cuenta de Correo';
    document.getElementById('modalAccountId').value = id;
    document.getElementById('modalEmail').value = email;
    document.getElementById('modalEmail').disabled = true; // Email no se cambia
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
            btnElement.className = 'px-3 py-1.5 bg-green-950 text-green-400 text-xs rounded-xl border border-green-800/50';
            btnElement.innerText = '✓ Login IMAP OK';
        } else {
            btnElement.className = 'px-3 py-1.5 bg-red-950 text-red-400 text-xs rounded-xl border border-red-800/50';
            btnElement.innerText = '✕ Error Login';
        }
    } catch (err) {
        btnElement.innerText = '✕ Error Red';
    } finally {
        setTimeout(() => {
            btnElement.disabled = false;
            btnElement.className = 'px-3 py-1.5 bg-brandBg hover:bg-brandBorder text-brandAccent text-xs rounded-xl border border-brandBorder transition';
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
        // Edición
        url = `${API_BASE}/admin/mail-accounts/${accountId}`;
        method = 'PUT';
        if (pass) {
            body.password_or_token = pass;
        }
    } else {
        // Creación
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

async function connectOAuth(provider) {
    try {
        const res = await fetch(`${API_BASE}/admin/oauth/authorize?provider=${provider}`);
        const data = await res.json();
        if (res.ok && data.auth_url) {
            // Abrir ventana modal de consentimiento oficial de Google/Microsoft
            const width = 600, height = 700;
            const left = (window.innerWidth - width) / 2;
            const top = (window.innerHeight - height) / 2;
            const popup = window.open(
                data.auth_url,
                `Conectar con ${provider}`,
                `width=${width},height=${height},top=${top},left=${left}`
            );

            // Monitorear cuando se cierre el popup para recargar la tabla de cuentas
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
        const clients = await res.json();

        tbody.innerHTML = '';
        if (!clients || clients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-brandMuted">No hay clientes autorizados en la lista blanca.</td></tr>`;
            return;
        }

        clients.forEach(client => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-brandBg/50 transition';
            const statusBadge = client.is_approved
                ? `<span class="px-2.5 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50">✓ Autorizado VIP</span>`
                : `<span class="px-2.5 py-0.5 rounded-full text-xs bg-rose-950 text-rose-400 border border-rose-800/50">✕ Revocado</span>`;

            const dateStr = new Date(client.created_at).toLocaleDateString();

            tr.innerHTML = `
                <td class="p-4 font-mono font-bold text-white">${client.telegram_chat_id}</td>
                <td class="p-4">${statusBadge}</td>
                <td class="p-4 font-mono text-brandMuted text-xs">${dateStr}</td>
                <td class="p-4 text-right">
                    <button onclick="toggleClientApproval(${client.telegram_chat_id}, ${!client.is_approved})" class="px-3 py-1.5 ${client.is_approved ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border-rose-800/50' : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800/50'} text-xs rounded-xl border transition font-medium">
                        ${client.is_approved ? '🚫 Revocar' : '✅ Autorizar'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-rose-400">Error cargando clientes.</td></tr>`;
    }
}

function openAuthorizeClientModal() {
    document.getElementById('authClientChatId').value = '';
    document.getElementById('authClientApproved').value = 'true';
    document.getElementById('authorizeClientModal').classList.remove('hidden');
}

function closeAuthorizeClientModal() {
    document.getElementById('authorizeClientModal').classList.add('hidden');
}

async function toggleClientApproval(chatId, approveState) {
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
                is_approved: approveState
            })
        });

        if (res.ok) {
            loadClients();
        } else {
            const data = await res.json();
            alert(`Error: ${data.detail || 'No se pudo cambiar el estado.'}`);
        }
    } catch (err) {
        alert('Error al conectar con el servidor.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authorizeClientForm');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const chatId = document.getElementById('authClientChatId').value;
            const approved = document.getElementById('authClientApproved').value === 'true';
            await toggleClientApproval(chatId, approved);
            closeAuthorizeClientModal();
        });
    }
});

