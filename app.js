const API_URL = "https://license-api.amyratfy8.workers.dev";
const JWT_KEY = "admin_jwt";
const REQUEST_TIMEOUT = 12000;


/* =========================================================
   AUTH
========================================================= */

function getJWT() {
    return sessionStorage.getItem(JWT_KEY);
}

function setJWT(token) {
    sessionStorage.setItem(JWT_KEY, token);
}

function clearJWT() {
    sessionStorage.removeItem(JWT_KEY);
}


/* =========================================================
   API
========================================================= */

async function api(path, options = {}) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT);

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const jwt = getJWT();

    if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
    }

    try {

        const response = await fetch(
            API_URL + path,
            {
                ...options,
                headers,
                signal: controller.signal
            }
        );

        const text = await response.text();

        let data;

        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = {
                ok: response.ok,
                raw: text
            };
        }

        if (!response.ok) {

            const errorMessage =
                data?.error ||
                data?.message ||
                data?.raw ||
                `HTTP ${response.status}`;

            throw new Error(errorMessage);
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error(
                "Worker پاسخ نداد و درخواست Timeout شد.\n" +
                "Worker URL:\n" +
                API_URL
            );
        }

        if (
            error instanceof TypeError ||
            String(error.message || "").toLowerCase().includes("fetch")
        ) {
            throw new Error(
                "اتصال به Worker برقرار نشد.\n" +
                "ممکن است مشکل CORS یا URL Worker باشد.\n\n" +
                "Worker URL:\n" +
                API_URL
            );
        }

        throw error;

    } finally {
        clearTimeout(timeout);
    }
}


/* =========================================================
   LOGIN PAGE
========================================================= */

async function login(event) {

    event.preventDefault();

    const passwordInput =
        document.getElementById("password");

    const loginButton =
        document.getElementById("loginButton");

    const message =
        document.getElementById("loginMessage");

    if (!passwordInput || !loginButton || !message) {
        return;
    }

    const password =
        passwordInput.value.trim();

    if (!password) {
        message.style.color = "#ff6b6b";
        message.textContent =
            "رمز عبور را وارد کنید.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "در حال ورود...";

    message.style.color = "#7f8ea3";
    message.textContent =
        "در حال اتصال به Worker...";

    try {

        const result = await api(
            "/admin/login",
            {
                method: "POST",
                body: JSON.stringify({
                    password: password
                })
            }
        );

        console.log("LOGIN RESPONSE:", result);

        if (!result || result.ok !== true) {

            throw new Error(
                result?.error ||
                "ورود انجام نشد."
            );
        }

        if (!result.token) {

            throw new Error(
                "Worker لاگین را قبول کرد ولی JWT برنگرداند."
            );
        }

        setJWT(result.token);

        message.style.color = "#21c77a";
        message.textContent =
            "ورود موفق بود. در حال باز کردن داشبورد...";

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 300);

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        clearJWT();

        message.style.color = "#ff6b6b";

        message.textContent =
            error.message ||
            "خطای ناشناخته در ورود.";

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
}


/* =========================================================
   DASHBOARD AUTH CHECK
========================================================= */

function requireAuth() {

    if (!getJWT()) {

        window.location.href =
            "index.html";

        return false;
    }

    return true;
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    clearJWT();

    window.location.href =
        "index.html";
}


/* =========================================================
   SECTION NAVIGATION
========================================================= */

function showSection(name) {

    const sections = [
        "dashboard",
        "licenses",
        "content",
        "logs"
    ];

    for (const section of sections) {

        const element =
            document.getElementById(
                "section-" + section
            );

        if (!element) {
            continue;
        }

        if (section === name) {
            element.classList.remove("hidden");
        } else {
            element.classList.add("hidden");
        }
    }

    if (name === "dashboard") {
        loadStats();
    }

    if (name === "licenses") {
        loadLicenses();
    }

    if (name === "logs") {
        loadLogs();
    }
}


/* =========================================================
   STATS
========================================================= */

async function loadStats() {

    try {

        const result =
            await api(
                "/admin/list-licenses",
                {
                    method: "POST",
                    body: JSON.stringify({})
                }
            );

        const licenses =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(result?.licenses)
                        ? result.licenses
                        : []
                );

        const now =
            Math.floor(Date.now() / 1000);

        let active = 0;
        let expired = 0;

        for (const license of licenses) {

            const isActive =
                Number(license.is_active) === 1;

            const expiresAt =
                Number(license.expires_at || 0);

            if (!isActive) {
                continue;
            }

            if (
                expiresAt > 0 &&
                expiresAt < now
            ) {
                expired++;
            } else {
                active++;
            }
        }

        const totalElement =
            document.getElementById("statTotal");

        const activeElement =
            document.getElementById("statActive");

        const expiredElement =
            document.getElementById("statExpired");

        if (totalElement) {
            totalElement.textContent =
                licenses.length;
        }

        if (activeElement) {
            activeElement.textContent =
                active;
        }

        if (expiredElement) {
            expiredElement.textContent =
                expired;
        }

    } catch (error) {

        console.error(
            "STATS ERROR:",
            error
        );
    }
}


/* =========================================================
   LICENSE LIST
========================================================= */

async function loadLicenses() {

    const table =
        document.getElementById("licensesTable");

    if (!table) {
        return;
    }

    table.innerHTML =
        "<tr><td colspan='8'>در حال دریافت...</td></tr>";

    try {

        const result =
            await api(
                "/admin/list-licenses",
                {
                    method: "POST",
                    body: JSON.stringify({})
                }
            );

        const licenses =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(result?.licenses)
                        ? result.licenses
                        : []
                );

        table.innerHTML = "";

        if (!licenses.length) {

            table.innerHTML =
                "<tr><td colspan='8'>هیچ لایسنسی وجود ندارد.</td></tr>";

            return;
        }

        for (const license of licenses) {

            const tr =
                document.createElement("tr");

            const expires =
                Number(license.expires_at || 0);

            const expiresText =
                expires === 0
                    ? "بدون انقضا"
                    : new Date(
                        expires * 1000
                    ).toLocaleString();

            let status;

            if (Number(license.is_active) !== 1) {
                status = "غیرفعال";
            } else if (
                expires > 0 &&
                expires < Math.floor(Date.now() / 1000)
            ) {
                status = "منقضی";
            } else {
                status = "فعال";
            }

            tr.innerHTML = `
                <td>${escapeHTML(license.id)}</td>

                <td>
                    <code>
                        ${escapeHTML(license.token)}
                    </code>
                </td>

                <td>
                    ${escapeHTML(license.owner_name)}
                </td>

                <td>
                    ${escapeHTML(status)}
                </td>

                <td>
                    ${escapeHTML(expiresText)}
                </td>

                <td>
                    ${escapeHTML(
                        license.hwid_locked || "آزاد"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        license.total_requests || 0
                    )}
                </td>

                <td>
                    <button
                        onclick="revokeLicense('${escapeAttribute(license.token)}')"
                        class="danger-btn">
                        لغو
                    </button>
                </td>
            `;

            table.appendChild(tr);
        }

    } catch (error) {

        console.error(
            "LICENSE LIST ERROR:",
            error
        );

        table.innerHTML =
            `<tr>
                <td colspan="8">
                    ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}


/* =========================================================
   CREATE LICENSE
========================================================= */

async function createLicense(event) {

    event.preventDefault();

    const ownerInput =
        document.getElementById("ownerName");

    const expiresInput =
        document.getElementById("expiresDays");

    const message =
        document.getElementById("licenseMessage");

    if (!ownerInput || !expiresInput || !message) {
        return;
    }

    const owner_name =
        ownerInput.value.trim();

    const expires_days =
        Number(expiresInput.value);

    if (!owner_name) {

        message.textContent =
            "نام مالک را وارد کنید.";

        return;
    }

    try {

        message.textContent =
            "در حال ساخت لایسنس...";

        const result =
            await api(
                "/admin/create-license",
                {
                    method: "POST",

                    body: JSON.stringify({
                        owner_name,
                        expires_days
                    })
                }
            );

        message.style.color =
            "#21c77a";

        message.textContent =
            "لایسنس ساخته شد: " +
            (result.token || "نامشخص");

        ownerInput.value = "";

        await loadLicenses();
        await loadStats();

    } catch (error) {

        console.error(
            "CREATE LICENSE ERROR:",
            error
        );

        message.style.color =
            "#ff6b6b";

        message.textContent =
            error.message;
    }
}


/* =========================================================
   REVOKE LICENSE
========================================================= */

async function revokeLicense(token) {

    if (!confirm(
        "این لایسنس غیرفعال شود؟"
    )) {
        return;
    }

    try {

        await api(
            "/admin/revoke-license",
            {
                method: "POST",

                body: JSON.stringify({
                    token
                })
            }
        );

        await loadLicenses();
        await loadStats();

    } catch (error) {

        alert(
            "خطا:\n" +
            error.message
        );
    }
}


/* =========================================================
   CONTENT
========================================================= */

async function loadContent() {

    const keyInput =
        document.getElementById("contentKey");

    const editor =
        document.getElementById("contentEditor");

    const message =
        document.getElementById("contentMessage");

    if (!keyInput || !editor || !message) {
        return;
    }

    const key_name =
        keyInput.value.trim();

    if (!key_name) {

        message.textContent =
            "کلید محتوا را وارد کنید.";

        return;
    }

    try {

        message.style.color =
            "#7f8ea3";

        message.textContent =
            "در حال دریافت محتوا...";

        const result =
            await api(
                "/admin/get-content",
                {
                    method: "POST",

                    body: JSON.stringify({
                        key_name
                    })
                }
            );

        const content =
            typeof result === "string"
                ? result
                : (
                    result?.content || ""
                );

        editor.value =
            content;

        message.style.color =
            "#21c77a";

        message.textContent =
            "محتوا دریافت شد.";

    } catch (error) {

        console.error(
            "LOAD CONTENT ERROR:",
            error
        );

        message.style.color =
            "#ff6b6b";

        message.textContent =
            error.message;
    }
}


async function saveContent() {

    const keyInput =
        document.getElementById("contentKey");

    const editor =
        document.getElementById("contentEditor");

    const message =
        document.getElementById("contentMessage");

    if (!keyInput || !editor || !message) {
        return;
    }

    const key_name =
        keyInput.value.trim();

    const content =
        editor.value;

    if (!key_name) {

        message.textContent =
            "کلید محتوا را وارد کنید.";

        return;
    }

    try {

        message.style.color =
            "#7f8ea3";

        message.textContent =
            "در حال ذخیره...";

        await api(
            "/admin/update-content",
            {
                method: "POST",

                body: JSON.stringify({
                    key_name,
                    content
                })
            }
        );

        message.style.color =
            "#21c77a";

        message.textContent =
            "محتوا با موفقیت ذخیره شد.";

    } catch (error) {

        console.error(
            "SAVE CONTENT ERROR:",
            error
        );

        message.style.color =
            "#ff6b6b";

        message.textContent =
            error.message;
    }
}


/* =========================================================
   LOGS
========================================================= */

async function loadLogs() {

    const table =
        document.getElementById("logsTable");

    if (!table) {
        return;
    }

    table.innerHTML =
        "<tr><td colspan='6'>در حال دریافت...</td></tr>";

    try {

        const result =
            await api(
                "/admin/logs",
                {
                    method: "POST",

                    body: JSON.stringify({
                        count: 100
                    })
                }
            );

        const logs =
            Array.isArray(result)
                ? result
                : (
                    Array.isArray(result?.logs)
                        ? result.logs
                        : []
                );

        table.innerHTML = "";

        if (!logs.length) {

            table.innerHTML =
                "<tr><td colspan='6'>لاگی وجود ندارد.</td></tr>";

        } else {

            for (const log of logs) {

                const tr =
                    document.createElement("tr");

                const timestamp =
                    Number(log.timestamp || 0);

                const timeText =
                    timestamp
                        ? new Date(
                            timestamp * 1000
                        ).toLocaleString()
                        : "-";

                tr.innerHTML = `
                    <td>${escapeHTML(log.id)}</td>

                    <td>
                        ${escapeHTML(log.token || "-")}
                    </td>

                    <td>
                        ${escapeHTML(log.ip || "-")}
                    </td>

                    <td>
                        ${escapeHTML(log.action || "-")}
                    </td>

                    <td>
                        ${escapeHTML(timeText)}
                    </td>

                    <td>
                        ${escapeHTML(
                            log.user_agent || "-"
                        )}
                    </td>
                `;

                table.appendChild(tr);
            }
        }

        const statLogs =
            document.getElementById("statLogs");

        if (statLogs) {
            statLogs.textContent =
                logs.length;
        }

    } catch (error) {

        console.error(
            "LOGS ERROR:",
            error
        );

        table.innerHTML =
            `<tr>
                <td colspan="6">
                    ${escapeHTML(error.message)}
                </td>
            </tr>`;
    }
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll() {

    await loadStats();
    await loadLicenses();
    await loadLogs();
}


/* =========================================================
   SECURITY HELPERS
========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value ?? "");

    return div.innerHTML;
}


function escapeAttribute(value) {

    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


/* =========================================================
   PAGE START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const loginForm =
            document.getElementById("loginForm");

        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                login
            );

            return;
        }


        const dashboard =
            document.getElementById(
                "section-dashboard"
            );

        if (dashboard) {

            if (!requireAuth()) {
                return;
            }

            showSection("dashboard");

            const createForm =
                document.getElementById(
                    "createLicenseForm"
                );

            if (createForm) {

                createForm.addEventListener(
                    "submit",
                    createLicense
                );
            }

            loadAll();
        }
    }
);
