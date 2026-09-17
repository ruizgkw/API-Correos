const API_BASE = '/api/v1';

// Estado global del cliente
let currentUser = null;
let cooldownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const token = localStorage.getItem('access_token');
    const chatId = localStorage.getItem('telegram_chat_id');

    if (token && chatId) {
        showExtractionSection(chatId);
        loadPlatforms();
    } else {
        showAuthSection();
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Formulario pedir OTP
    document.getElementById('requestOtpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const chatId = document.getElementById('inputChatId').value;
        await requestOtp(chatId);
    });

    // Formulario verificar OTP
    document.getElementById('verifyOtpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const chatId = document.getElementById('inputChatId').value;
        const otp = document.getElementById('inputOtp').value;
        await verifyOtp(chatId, otp);
    });

    const returnToLoginHome = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('telegram_chat_id');
        showAuthSection();
    };

    // Botones Volver para cliente final
    const clientBackBtn = document.getElementById('clientBackBtn');
    if (clientBackBtn) clientBackBtn.addEventListener('click', returnToLoginHome);

    const dashboardBackBtn = document.getElementById('dashboardBackBtn');
    if (dashboardBackBtn) dashboardBackBtn.addEventListener('click', returnToLoginHome);

    const btnBackToRequestOtp = document.getElementById('btnBackToRequestOtp');
    if (btnBackToRequestOtp) {
        btnBackToRequestOtp.addEventListener('click', () => {
            const verifyForm = document.getElementById('verifyOtpForm');
            if (verifyForm) verifyForm.classList.add('hidden');
            const reqForm = document.getElementById('requestOtpForm');
            if (reqForm) reqForm.classList.remove('hidden');
            hideAlert('authAlert');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', returnToLoginHome);
    }

    // Extracción de código
    document.getElementById('extractionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const platformId = document.getElementById('selectPlatform').value;
        const email = document.getElementById('inputEmail').value;
        await handleExtraction(platformId, email);
    });

    // Copiar código
    document.getElementById('btnCopyCode').addEventListener('click', () => {
        const codeText = document.getElementById('extractedCodeText').innerText;
        navigator.clipboard.writeText(codeText).then(() => {
            const btn = document.getElementById('btnCopyCode');
            const orig = btn.innerHTML;
            btn.innerHTML = '<span>¡Copiado!</span>';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });
}

function showAuthSection() {
    const landing = document.getElementById('splitLandingContainer');
    const dashboard = document.getElementById('clientDashboard');
    const userBadge = document.getElementById('userBadge');
    const clientBackBtn = document.getElementById('clientBackBtn');
    const mobileBtn = document.getElementById('mobileLoginToggleBtn');
    const authSection = document.getElementById('authSection');
    const reqForm = document.getElementById('requestOtpForm');
    const verifyForm = document.getElementById('verifyOtpForm');

    if (landing) landing.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    if (userBadge) userBadge.classList.add('hidden');
    if (clientBackBtn) clientBackBtn.classList.add('hidden');
    if (mobileBtn) mobileBtn.classList.remove('hidden');
    if (authSection) authSection.classList.remove('hidden');
    if (reqForm) reqForm.classList.remove('hidden');
    if (verifyForm) verifyForm.classList.add('hidden');
    hideAlert('authAlert');
}

function showExtractionSection(chatId) {
    // 1. Ocultar por completo la landing page (tanto tutorial como columna de login)
    const landing = document.getElementById('splitLandingContainer');
    if (landing) landing.classList.add('hidden');

    // 2. Mostrar el panel del sistema de extracción (centrado y espacioso)
    const dashboard = document.getElementById('clientDashboard');
    if (dashboard) dashboard.classList.remove('hidden');

    // 3. Mostrar identificador de usuario y botón volver en el header
    const userBadge = document.getElementById('userBadge');
    if (userBadge) userBadge.classList.remove('hidden');
    const chatIdSpan = document.getElementById('chatIdSpan');
    if (chatIdSpan) chatIdSpan.innerText = `ID: ${chatId}`;
    const clientBackBtn = document.getElementById('clientBackBtn');
    if (clientBackBtn) clientBackBtn.classList.remove('hidden');

    // 4. Ocultar botón móvil y cerrar modal si estaba abierto
    const mobileBtn = document.getElementById('mobileLoginToggleBtn');
    if (mobileBtn) mobileBtn.classList.add('hidden');
    const backdrop = document.getElementById('mobileModalBackdrop');
    if (backdrop) backdrop.classList.add('hidden');

    const rightCol = document.getElementById('rightLoginColumn');
    if (rightCol) {
        rightCol.style.display = '';
        rightCol.classList.remove('fixed', 'left-4', 'right-4', 'top-12', 'z-50', 'max-w-sm');
    }
}

async function requestOtp(chatId) {
    const btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    try {
        const res = await fetch(`${API_BASE}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_chat_id: parseInt(chatId) })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            document.getElementById('requestOtpForm').classList.add('hidden');
            document.getElementById('verifyOtpForm').classList.remove('hidden');
            showAlert('authAlert', 'Código enviado a tu chat de Telegram.', 'success');
        } else {
            showAlert('authAlert', data.detail || 'Error al solicitar OTP', 'error');
        }
    } catch (err) {
        showAlert('authAlert', 'Error de conexión con el servidor.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Enviar Código a Telegram';
    }
}

async function verifyOtp(chatId, otpCode) {
    const btn = document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.innerText = 'Verificando...';

    try {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_chat_id: parseInt(chatId),
                otp_code: otpCode
            })
        });
        const data = await res.json();

        if (res.ok && data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('telegram_chat_id', data.telegram_chat_id);
            showExtractionSection(data.telegram_chat_id);
            loadPlatforms();
        } else {
            showAlert('authAlert', data.detail || 'OTP Incorrecto o expirado.', 'error');
        }
    } catch (err) {
        showAlert('authAlert', 'Error al verificar OTP.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Verificar e Ingresar';
    }
}

async function loadPlatforms() {
    const select = document.getElementById('selectPlatform');
    try {
        const res = await fetch(`${API_BASE}/extraction/platforms`);
        const platforms = await res.json();

        select.innerHTML = '<option value="">-- Selecciona una plataforma --</option>';
        platforms.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.name;
            select.appendChild(opt);
        });
    } catch (err) {
        select.innerHTML = '<option value="">Error cargando plataformas</option>';
    }
}

function setBtnExtractText(text) {
    const btnText = document.getElementById('btnExtractText');
    if (btnText) {
        btnText.innerText = text;
    } else {
        const btn = document.getElementById('btnExtract');
        if (btn) {
            const span = btn.querySelector('span');
            if (span) span.innerText = text;
            else btn.innerText = text;
        }
    }
}

async function handleExtraction(platformId, email) {
    const btn = document.getElementById('btnExtract');
    const token = localStorage.getItem('access_token');
    const resultCard = document.getElementById('resultCard') || document.getElementById('resultContainer');

    if (!platformId) {
        showAlert('extractionAlert', 'Por favor selecciona una plataforma de streaming.', 'warning');
        return;
    }
    if (!email) {
        showAlert('extractionAlert', 'Por favor ingresa un correo.', 'warning');
        return;
    }

    if (btn) btn.disabled = true;
    setBtnExtractText('Consultando correo...');
    if (resultCard) resultCard.classList.add('hidden');
    hideAlert('extractionAlert');

    try {
        const res = await fetch(`${API_BASE}/extraction/extract-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                platform_id: parseInt(platformId),
                email: email.trim()
            })
        });

        const data = await res.json();

        if (res.status === 429) {
            // Manejar Cooldown activo de 7 minutos
            const seconds = (data.detail && data.detail.cooldown_remaining_seconds) || 420;
            startCooldownTimer(seconds);
            showAlert('extractionAlert', (data.detail && data.detail.message) || 'Cooldown activo.', 'warning');
        } else if (res.ok && data.success) {
            // Éxito
            const codeEl = document.getElementById('extractedCodeText');
            if (codeEl) codeEl.innerText = data.extracted_code;

            const badgeEl = document.getElementById('platformResultBadge');
            if (badgeEl) badgeEl.innerText = `Plataforma: ${data.platform_name}`;

            const metaEl = document.getElementById('extractedMeta');
            if (metaEl) metaEl.innerText = `Código generado con éxito • Expira en pocos minutos`;

            if (resultCard) resultCard.classList.remove('hidden');
            
            // Iniciar cooldown de 7 minutos (420 segundos)
            startCooldownTimer(data.cooldown_seconds || 420);
        } else {
            const errorMsg = data.message || (typeof data.detail === 'string' ? data.detail : 'No se pudo obtener el código.');
            showAlert('extractionAlert', errorMsg, 'error');
            if (btn) btn.disabled = false;
            setBtnExtractText('🔍 Buscar Código Ahora');
        }
    } catch (err) {
        showAlert('extractionAlert', 'Error de conexión con el servidor.', 'error');
        if (btn) btn.disabled = false;
        setBtnExtractText('🔍 Buscar Código Ahora');
    }
}

function startCooldownTimer(totalSeconds) {
    const container = document.getElementById('cooldownContainer');
    const timerText = document.getElementById('cooldownTimerText');
    const progressBar = document.getElementById('cooldownProgressBar');
    const btn = document.getElementById('btnExtract');

    if (container) container.classList.remove('hidden');
    if (btn) btn.disabled = true;

    let remaining = totalSeconds;

    if (cooldownInterval) clearInterval(cooldownInterval);

    const updateUI = () => {
        const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
        const secs = String(remaining % 60).padStart(2, '0');
        if (timerText) timerText.innerText = `${mins}:${secs}`;
        setBtnExtractText(`Espera (${mins}:${secs})`);

        if (progressBar) {
            const pct = Math.max(0, Math.min(100, (remaining / 420) * 100));
            progressBar.style.width = `${pct}%`;
        }
    };

    updateUI();

    cooldownInterval = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            if (container) container.classList.add('hidden');
            if (btn) btn.disabled = false;
            setBtnExtractText('🔍 Buscar Código Ahora');
            return;
        }

        updateUI();
    }, 1000);
}

function showAlert(elementId, msg, type) {
    const el = document.getElementById(elementId);
    el.innerText = msg;
    el.classList.remove('hidden', 'bg-red-950/50', 'text-red-400', 'bg-green-950/50', 'text-green-400', 'bg-amber-950/50', 'text-amber-400');
    
    if (type === 'error') {
        el.classList.add('bg-red-950/50', 'text-red-400', 'border', 'border-red-800/50');
    } else if (type === 'success') {
        el.classList.add('bg-green-950/50', 'text-green-400', 'border', 'border-green-800/50');
    } else if (type === 'warning') {
        el.classList.add('bg-amber-950/50', 'text-amber-400', 'border', 'border-amber-800/50');
    }
}

function hideAlert(elementId) {
    document.getElementById(elementId).classList.add('hidden');
}
