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

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });

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
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('extractionSection').classList.add('hidden');
    document.getElementById('userBadge').classList.add('hidden');
    const leftCol = document.getElementById('leftBrandColumn');
    if (leftCol) leftCol.classList.remove('hidden');
}

function showExtractionSection(chatId) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('extractionSection').classList.remove('hidden');
    document.getElementById('userBadge').classList.remove('hidden');
    document.getElementById('chatIdSpan').innerText = `ID: ${chatId}`;
    const leftCol = document.getElementById('leftBrandColumn');
    if (leftCol) leftCol.classList.add('hidden');
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

async function handleExtraction(platformId, email) {
    const btn = document.getElementById('btnExtract');
    const token = localStorage.getItem('access_token');

    btn.disabled = true;
    document.getElementById('btnExtractText').innerText = 'Consultando correo...';
    document.getElementById('resultContainer').classList.add('hidden');
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
                email: email
            })
        });

        const data = await res.json();

        if (res.status === 429) {
            // Manejar Cooldown activo de 7 minutos
            const seconds = data.detail.cooldown_remaining_seconds || 420;
            startCooldownTimer(seconds);
            showAlert('extractionAlert', data.detail.message || 'Cooldown activo.', 'warning');
        } else if (res.ok && data.success) {
            // Éxito
            document.getElementById('extractedCodeText').innerText = data.extracted_code;
            document.getElementById('platformResultBadge').innerText = `Plataforma: ${data.platform_name}`;
            document.getElementById('resultContainer').classList.remove('hidden');
            
            // Iniciar cooldown de 7 minutos (420 segundos)
            startCooldownTimer(420);
        } else {
            showAlert('extractionAlert', data.message || data.detail || 'No se pudo obtener el código.', 'error');
            btn.disabled = false;
            document.getElementById('btnExtractText').innerText = 'Generar Código';
        }
    } catch (err) {
        showAlert('extractionAlert', 'Error de conexión con el servidor.', 'error');
        btn.disabled = false;
        document.getElementById('btnExtractText').innerText = 'Generar Código';
    }
}

function startCooldownTimer(totalSeconds) {
    const container = document.getElementById('cooldownContainer');
    const timerText = document.getElementById('cooldownTimerText');
    const progressBar = document.getElementById('cooldownProgressBar');
    const btn = document.getElementById('btnExtract');

    container.classList.remove('hidden');
    btn.disabled = true;

    let remaining = totalSeconds;

    if (cooldownInterval) clearInterval(cooldownInterval);

    cooldownInterval = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(cooldownInterval);
            container.classList.add('hidden');
            btn.disabled = false;
            document.getElementById('btnExtractText').innerText = 'Generar Código';
            return;
        }

        const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
        const secs = String(remaining % 60).padStart(2, '0');
        timerText.innerText = `${mins}:${secs}`;
        document.getElementById('btnExtractText').innerText = `Espera (${mins}:${secs})`;

        const pct = (remaining / 420) * 100;
        progressBar.style.width = `${pct}%`;
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
