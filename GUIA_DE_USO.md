# 📘 EAcodigos — Guía de Uso del Sistema

> **Versión:** 1.0  
> **Última actualización:** Septiembre 2026  
> **Tema visual:** Midnight Indigo

---

## 📌 Información General

| Concepto | Detalle |
| :--- | :--- |
| **Nombre** | EAcodigos — Extractor Autónomo de Códigos de Verificación |
| **Landing Comercial** | `http://localhost:8990/` |
| **Portal de Clientes VIP** | `http://localhost:8990/login` |
| **Panel de Administración** | `http://localhost:8990/admin` |
| **Documentación API** | `http://localhost:8990/docs` |

---

## 🔷 PARTE 1: PANEL DE ADMINISTRACIÓN (`/admin`)

El administrador es el dueño de las cuentas de correo y el responsable de configurar todo el sistema. Solo él puede agregar cuentas IMAP, autorizar clientes y gestionar la seguridad.

---

### 1.1 Registro de Administrador (Primera vez)

1. Accede a `http://localhost:8990/` (en la columna derecha) o a `http://localhost:8990/admin`.
2. Haz clic en la pestaña **"Registrarse"**.
3. Completa los campos:
   - **Telegram Chat ID:** Tu ID numérico de Telegram (puedes obtenerlo enviando un mensaje a [@userinfobot](https://t.me/userinfobot)).
   - **Nombre de Usuario:** Un nombre único para tu cuenta de administrador.
   - **Contraseña Maestra:** Una contraseña segura que solo tú conozcas.
   - **Licencia de Activación:** El código de licencia único entregado por el proveedor/vendedor de la instalación (definido en `ADMIN_LICENSE_KEY`).
4. Haz clic en **"Activar y Registrar Admin"**.
5. Si la licencia y los datos son correctos, verás un mensaje de éxito. Ya puedes iniciar sesión de inmediato.

---

### 1.2 Inicio de Sesión del Administrador (2FA con Telegram)

El acceso del administrador tiene **doble factor de autenticación (2FA)** para máxima seguridad:

**Paso 1 — Credenciales:**
1. En la pestaña **"Iniciar Sesión"**, ingresa tu **nombre de usuario** y **contraseña maestra**.
2. Haz clic en **"Verificar Credenciales"**.

**Paso 2 — Código OTP por Telegram:**
1. Si las credenciales son correctas, recibirás un **código de 6 dígitos** en tu chat privado del bot de Telegram.
2. Ingresa el código en el campo que aparece.
3. Haz clic en **"Verificar OTP e Ingresar"**.
4. Accederás al **Dashboard de Administración**.

> ⏰ El código OTP expira en **5 minutos**. Si no lo recibes, verifica que tu Telegram Bot Token esté configurado correctamente en el archivo `.env`.

---

### 1.3 Gestión de Cuentas de Correo

Una vez dentro del dashboard, verás la sección **"Gestión de Cuentas de Correo"**. Aquí puedes agregar las cuentas de correo donde llegan los códigos de verificación de las plataformas de streaming.

#### Opción A: Agregar cuenta manualmente (App Password) — ✅ Recomendado

1. Haz clic en el botón **"+ Agregar Manual"**.
2. Completa el formulario:
   - **Correo Electrónico:** La dirección de correo (ej. `micuenta@gmail.com`).
   - **Proveedor:** Selecciona `GMAIL`, `OUTLOOK` o `GENERIC_IMAP`.
   - **Tipo de Autenticación:** Selecciona `APP_PASSWORD`.
   - **Contraseña / App Password:** Ingresa la contraseña de aplicación de 16 caracteres generada desde tu cuenta de Google.
   - **Servidor IMAP:** `imap.gmail.com` (para Gmail) o `imap-mail.outlook.com` (para Outlook).
   - **Puerto IMAP:** `993`.
3. Haz clic en **"Guardar Cuenta"**.

##### ¿Cómo generar una App Password en Gmail?

1. Ve a [myaccount.google.com](https://myaccount.google.com) con la cuenta de correo que quieres agregar.
2. Ve a **Seguridad** → **Verificación en 2 pasos** (actívala si aún no lo está).
3. Dentro de Verificación en 2 pasos, busca la opción **"Contraseñas de aplicaciones"**.
4. Selecciona **"Otro"** y escribe un nombre (ej. `EAcodigos`).
5. Google te dará una contraseña de 16 letras (ejemplo: `abcd efgh ijkl mnop`).
6. Copia esas 16 letras y úsalas como contraseña al agregar la cuenta en el panel.

#### Opción B: Conectar vía OAuth2 (1-Clic)

1. Haz clic en **"🔑 Conectar Gmail (OAuth2)"** o **"🔑 Conectar Hotmail/Outlook (OAuth2)"**.
2. Se abrirá una ventana emergente de Google o Microsoft donde deberás autorizar el acceso.
3. Al completar la autorización, la cuenta se vinculará automáticamente al sistema.

> ⚠️ La conexión OAuth2 requiere tener configurado un proyecto en Google Cloud Console o Azure. Para uso privado/personal, la opción de App Password es más sencilla y gratuita.

#### Probar Conexión IMAP

Después de agregar una cuenta, puedes verificar que las credenciales sean correctas:

1. En la tabla de cuentas de correo, haz clic en el botón **"⚡ Probar IMAP"** de la cuenta que quieres verificar.
2. El sistema intentará conectarse al servidor IMAP y autenticarse con las credenciales almacenadas.
3. Verás:
   - ✅ **"✓ Login IMAP OK"** si la conexión es exitosa.
   - ❌ **"✕ Error Login"** si hay un problema con las credenciales o el servidor.

#### Editar una Cuenta

1. Haz clic en **"✏️ Editar"** en la fila de la cuenta que deseas modificar.
2. Actualiza los campos necesarios (contraseña, servidor, puerto, etc.).
3. Haz clic en **"Guardar Cuenta"**.

---

### 1.4 Lista Blanca de Clientes VIP

En esta sección controlas **quién tiene acceso** al portal de clientes para extraer códigos.

#### Autorizar un nuevo cliente

1. Haz clic en **"+ Autorizar Nuevo Cliente"**.
2. Ingresa el **Telegram Chat ID** del cliente que quieres autorizar.
3. Haz clic en **"Autorizar"**.
4. El cliente aparecerá en la tabla con estado **"Autorizado ✓"**.

#### Revocar acceso a un cliente

1. En la tabla de clientes, haz clic en **"🚫 Revocar"** en la fila del cliente.
2. El cliente perderá inmediatamente el acceso al sistema de extracción de códigos.
3. Puedes volver a autorizarlo en cualquier momento haciendo clic en **"✅ Autorizar"**.

> 💡 Solo los clientes con estado **Autorizado** pueden solicitar OTPs y extraer códigos. Si un cliente fue revocado, su sesión activa dejará de funcionar de inmediato.

#### ¿Cómo le doy acceso a un cliente?

1. Autoriza su Telegram Chat ID en la Lista Blanca (paso anterior).
2. Compártele el enlace privado del portal: `http://tudominio.com/login`.
3. El cliente podrá autenticarse con su Telegram y comenzar a extraer códigos.

---

### 1.5 Cerrar Sesión del Administrador

- Haz clic en el botón **"Cerrar Sesión"** en la esquina superior derecha del dashboard.
- Tu sesión se eliminará del navegador y serás redirigido a la pantalla de login.

---

## 🟢 PARTE 2: PORTAL DE CLIENTES VIP (`/login`)

El cliente final (usuario VIP) es la persona autorizada por el administrador para consultar códigos de verificación de plataformas de streaming. No necesita conocer ningún detalle técnico.

---

### 2.1 Acceso al Portal

1. El cliente recibe el enlace privado de su proveedor (administrador): `http://tudominio.com/login`.
2. Al abrir el enlace, verá:
   - **Lado izquierdo:** Un tutorial visual de 4 pasos que explica cómo funciona el sistema.
   - **Lado derecho:** El formulario de inicio de sesión con el mensaje **"¡Bienvenido!"**.

---

### 2.2 Iniciar Sesión (OTP por Telegram)

**Paso 1 — Identificación:**
1. En el campo **"Tu Telegram Chat ID Autorizado"**, ingresa tu ID numérico de Telegram.
   - Si no conoces tu ID, haz clic en el enlace **"¿No sabes tu ID?"** que te llevará a [@userinfobot](https://t.me/userinfobot) en Telegram. Envíale cualquier mensaje y te responderá con tu Chat ID.
2. Haz clic en **"🚀 Enviar Código a Telegram"**.

**Paso 2 — Verificación:**
1. Recibirás un **código de 6 dígitos** en tu chat privado del bot de Telegram.
2. Ingresa el código en el campo que aparece.
3. Haz clic en **"Verificar e Ingresar al Sistema"**.
4. Si el código es correcto, accederás al **Panel de Extracción de Códigos**.

> ⏰ El código OTP es válido por **5 minutos**. Si expira, puedes solicitar uno nuevo.

---

### 2.3 Extraer un Código de Verificación

Una vez dentro del sistema, el cliente verá el panel de extracción centrado en pantalla:

1. **Selecciona la plataforma:** Despliega el menú y elige el servicio de streaming (ej. Disney+, HBO Max, Netflix).
2. **Escribe el correo:** Ingresa la dirección de correo electrónico asignada a tu suscripción o pantalla.
3. **Haz clic en "Buscar Código Ahora".**
4. El sistema:
   - Se conecta al buzón de correo vía IMAP en tiempo real.
   - Busca el correo más reciente de la plataforma seleccionada (máximo 10 minutos de antigüedad).
   - Extrae el código numérico del cuerpo del correo.
5. **Resultado:**
   - ✅ Si se encuentra el código, aparecerá en pantalla con tamaño grande y un botón para **📋 Copiar al Portapapeles**.
   - ❌ Si no se encuentra, se mostrará un mensaje indicando que no hay correos recientes de esa plataforma. En ese caso, solicita un nuevo código desde la plataforma de streaming y vuelve a intentar.

---

### 2.4 Sistema de Cooldown (Anti-spam)

Para proteger el sistema contra el uso excesivo:

- Después de cada extracción exitosa, se activa un **temporizador de 7 minutos** (420 segundos).
- Durante ese tiempo, no podrás solicitar otro código para la **misma combinación** de plataforma + correo.
- El temporizador se muestra en pantalla con una **barra de progreso** y **cuenta regresiva** en formato `mm:ss`.
- Otras combinaciones (diferente plataforma o diferente correo) no se ven afectadas.

> 💡 El cooldown persiste en el servidor (Redis), por lo que recargar la página no lo reinicia.

---

### 2.5 Cerrar Sesión del Cliente

- Haz clic en **"Cerrar Sesión"** en la esquina superior derecha.
- La sesión se eliminará y volverás a la pantalla de bienvenida con el tutorial y el formulario de login.

---

## 🏗️ Arquitectura Técnica (Resumen)

```
  ┌───────────────────────────────────────────┐
  │           Cliente / Navegador Web          │
  │   Landing (/) · Login (/login) · Admin     │
  └─────────────────────┬─────────────────────┘
                        │ HTTP / REST API (JWT)
  ┌─────────────────────▼─────────────────────┐
  │          FastAPI Backend Container          │
  │           (Puerto interno 8000)             │
  │  ┌─────────┐ ┌──────────┐ ┌────────────┐  │
  │  │Auth OTP │ │Extracción│ │ Admin CRUD │  │
  │  │Telegram │ │IMAP/Parse│ │ OAuth2/2FA │  │
  │  └────┬────┘ └────┬─────┘ └─────┬──────┘  │
  └───────┼───────────┼─────────────┼──────────┘
          │           │             │
  ┌───────▼───┐ ┌─────▼─────┐ ┌────▼────┐
  │  Redis 7  │ │PostgreSQL │ │Telegram │
  │ OTP/Cool  │ │  15-DB    │ │ Bot API │
  └───────────┘ └───────────┘ └─────────┘
```

| Componente | Tecnología | Función |
| :--- | :--- | :--- |
| **Frontend** | HTML5 + Tailwind CSS + Vanilla JS | Interfaz de usuario (SPA sin build) |
| **Backend** | FastAPI (Python 3.11, Async) | API REST, lógica de negocio |
| **Base de Datos** | PostgreSQL 15 (AsyncPG + SQLAlchemy) | Usuarios, cuentas de correo, plataformas, logs |
| **Caché** | Redis 7 | OTPs temporales (5 min), cooldowns (7 min) |
| **Correo** | aioimaplib (IMAP SSL) | Lectura asíncrona de buzones |
| **Notificaciones** | Telegram Bot API | Envío de códigos OTP |
| **Cifrado** | Fernet AES-256 | Credenciales IMAP cifradas en reposo |
| **Autenticación** | JWT HS256 + PBKDF2-SHA256 | Tokens de sesión y hash de contraseñas |
| **Contenedores** | Docker Compose | Orquestación de los 3 servicios |

---

## 🔒 Seguridad del Sistema

- Las contraseñas de correo se cifran con **Fernet AES-256** antes de guardarse en la base de datos.
- Las contraseñas de administrador se hashean con **PBKDF2-SHA256** (no se almacenan en texto plano).
- Los tokens de sesión (JWT) expiran automáticamente en **7 días**.
- El acceso de clientes está controlado por la **Lista Blanca VIP**: solo los Telegram Chat IDs autorizados pueden operar.
- Si un administrador revoca el acceso de un cliente, el bloqueo es **inmediato**.
- Cada extracción de código queda registrada en un **log de auditoría** en la base de datos.

---

## ❓ Preguntas Frecuentes

### ¿Qué hago si el sistema dice "No se encontraron correos recientes"?
El sistema solo busca correos con **menos de 10 minutos de antigüedad**. Solicita un nuevo código desde la plataforma de streaming (ej. "Iniciar sesión" en Disney+) y luego extrae el código inmediatamente.

### ¿Qué hago si me sale "Cooldown activo"?
Debes esperar a que el temporizador de 7 minutos termine. Esto protege el sistema contra solicitudes excesivas.

### ¿Por qué no recibo el código OTP en Telegram?
1. Verifica que tu Telegram Chat ID sea correcto.
2. Asegúrate de que el bot de Telegram esté activo (puedes escribirle `/start`).
3. Si eres cliente, confirma con tu administrador que tu Chat ID esté en la Lista Blanca.

### ¿Es seguro? ¿Se guarda mi contraseña de correo en texto plano?
No. Todas las credenciales se cifran con **AES-256** antes de guardarse. Nadie, ni siquiera el administrador, puede ver la contraseña original una vez almacenada.
