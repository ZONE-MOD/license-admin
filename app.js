const API_URL =
    "https://YOUR-WORKER.workers.dev";


/* =========================================================
   HELPERS
========================================================= */

function getJWT() {
    return sessionStorage.getItem("admin_jwt");
}


function setJWT(token) {
    sessionStorage.setItem(
        "admin_jwt",
        token
    );
}


function clearJWT() {
    sessionStorage.removeItem(
        "admin_jwt"
    );
}


async function api(path, body = {}) {

    const headers = {
        "Content-Type":
            "application/json"
    };

    const jwt = getJWT();

    if (jwt) {
        headers.Authorization =
            `Bearer ${jwt}`;
    }

    const response =
        await fetch(
            API_URL + path,
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            }
        );

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (
        response.status === 401
    ) {
        clearJWT();

        if (
            !location.pathname.endsWith(
                "index.html"
            )
        ) {
            location.href =
                "index.html";
        }

        throw new Error(
            "نشست منقضی شده است."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Request failed"
        );
    }

    if (data.ok === false) {
        throw new Error(
            data.error ||
            "Request failed"
        );
    }

    return data;
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

    const password =
        document.getElementById(
            "password"
        ).value;

    const message =
        document.getElementById(
            "loginMessage"
        );

    message.textContent =
        "در حال ورود...";

    try {

        const result =
            await api(
                "/admin/login",
                {
                    password
                }
            );

        setJWT(result.token);

        /*
          We intentionally store the temporary JWT,
          not the administrator password.
        */

        location.href =
            "dashboard.html";

    } catch (error) {

        message.textContent =
            error.message ||
            "ورود ناموفق بود.";

    }
}


/* =========================================================
   DASHBOARD NAVIGATION
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
                `section-${section}`
            );

        if (!element) {
            continue;
        }

        element.classList.toggle(
            "hidden",
            section !== name
        );
    }

    if (name === "licenses") {
        loadLicenses();
    }

    if (name === "content") {
        loadContent();
    }

    if (name === "logs") {
        loadLogs();
    }
}


/* =========================================================
   LICENSES
========================================================= */

async function loadLicenses() {

    const tbody =
        document.getElementById(
            "licensesTable"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML =
        `<tr>
            <td colspan="8">
                Loading...
            </td>
        </tr>`;

    try {

        const result =
            await api(
                "/admin/list-licenses"
            );

        const licenses =
            result.licenses || [];

        tbody.innerHTML = "";

        const now =
            Math.floor(
                Date.now() / 1000
            );

        let active = 0;
        let expired = 0;

        for (const license of licenses) {

            const isActive =
                Number(
                    license.is_active
                ) === 1;

            const isExpired =
                Number(
                    license.expires_at
                ) !== 0 &&
                Number(
                    license.expires_at
                ) < now;

            if (isActive && !isExpired) {
                active++;
            }

            if (isExpired) {
                expired++;
            }

            const tr =
                document.createElement(
                    "tr"
                );

            const status =
                !isActive
                    ? `<span class="inactive">
                           revoked
                       </span>`
                    : isExpired
                        ? `<span class="expired">
                               expired
                           </span>`
                        : `<span class="active">
                               active
                           </span>`;

            const expiry =
                Number(
                    license.expires_at
                ) === 0
                    ? "بدون انقضا"
                    : new Date(
                        Number(
                            license.expires_at
                        ) * 1000
                    ).toLocaleString();

            const hwid =
                license.hwid_locked
                    ? "LOCKED"
                    : "EMPTY";

            tr.innerHTML = `
                <td>${escapeHtml(
                    license.id
                )}</td>

                <td class="token-cell">
                    ${escapeHtml(
                        license.token
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        license.owner_name
                    )}
                </td>

                <td>
                    ${status}
                </td>

                <td>
                    ${escapeHtml(
                        expiry
                    )}
                </td>

                <td>
                    ${hwid}
                </td>

                <td>
                    ${escapeHtml(
                        license.total_requests
                    )}
                </td>

                <td>

                    ${
                        isActive
                        ?
                        `<button
                            onclick="revokeLicense(
                                '${escapeJs(
                                    license.token
                                )}'
                            )"
                            class="danger-btn">
                            لغو
                         </button>`
                        :
                        "-"
                    }

                </td>
            `;

            tbody.appendChild(tr);
        }

        document.getElementById(
            "statActive"
        ).textContent = active;

        document.getElementById(
            "statTotal"
        ).textContent =
            licenses.length;

        document.getElementById(
            "statExpired"
        ).textContent = expired;

    } catch (error) {

        tbody.innerHTML =
            `<tr>
                <td colspan="8">
                    ${escapeHtml(
                        error.message
                    )}
                </td>
            </tr>`;
    }
}


/* =========================================================
   CREATE LICENSE
========================================================= */

async function createLicense(event) {

    event.preventDefault();

    const ownerName =
        document.getElementById(
            "ownerName"
        ).value.trim();

    const expiresDays =
        Number(
            document.getElementById(
                "expiresDays"
            ).value
        );

    const message =
        document.getElementById(
            "licenseMessage"
        );

    message.textContent =
        "در حال ساخت...";

    try {

        const result =
            await api(
                "/admin/create-license",
                {
                    owner_name:
                        ownerName,

                    expires_days:
                        expiresDays
                }
            );

        message.textContent =
            `لایسنس ساخته شد:\n\n${result.token}`;

        document.getElementById(
            "createLicenseForm"
        ).reset();

        document.getElementById(
            "expiresDays"
        ).value = "30";

        await loadLicenses();

    } catch (error) {

        message.textContent =
            error.message;

    }
}


/* =========================================================
   REVOKE
========================================================= */

async function revokeLicense(token) {

    const confirmed =
        confirm(
            "آیا از لغو این لایسنس مطمئن هستید؟"
        );

    if (!confirmed) {
        return;
    }

    try {

        await api(
            "/admin/revoke-license",
            {
                token
            }
        );

        await loadLicenses();

    } catch (error) {

        alert(
            error.message
        );
    }
}


/* =========================================================
   CONTENT
========================================================= */

async function loadContent() {

    const keyName =
        document.getElementById(
            "contentKey"
        );

    const editor =
        document.getElementById(
            "contentEditor"
        );

    if (!keyName || !editor) {
        return;
    }

    try {

        const result =
            await api(
                "/admin/get-content",
                {
                    key_name:
                        keyName.value
                }
            );

        editor.value =
            result.content || "";

        const message =
            document.getElementById(
                "contentMessage"
            );

        message.textContent =
            `Version: ${result.version}`;

    } catch (error) {

        editor.value = "";

        const message =
            document.getElementById(
                "contentMessage"
            );

        message.textContent =
            error.message;
    }
}


async function saveContent() {

    const keyName =
        document.getElementById(
            "contentKey"
        ).value.trim();

    const content =
        document.getElementById(
            "contentEditor"
        ).value;

    const message =
        document.getElementById(
            "contentMessage"
        );

    message.textContent =
        "در حال ذخیره...";

    try {

        const result =
            await api(
                "/admin/update-content",
                {
                    key_name:
                        keyName,

                    content
                }
            );

        message.textContent =
            `ذخیره شد. Version: ${result.version}`;

    } catch (error) {

        message.textContent =
            error.message;
    }
}


/* =========================================================
   LOGS
========================================================= */

async function loadLogs() {

    const tbody =
        document.getElementById(
            "logsTable"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML =
        `<tr>
            <td colspan="6">
                Loading...
            </td>
        </tr>`;

    try {

        const result =
            await api(
                "/admin/logs",
                {
                    count: 100
                }
            );

        const logs =
            result.logs || [];

        tbody.innerHTML = "";

        document.getElementById(
            "statLogs"
        ).textContent =
            logs.length;

        for (const log of logs) {

            const tr =
                document.createElement(
                    "tr"
                );

            const date =
                new Date(
                    Number(
                        log.timestamp
                    ) * 1000
                ).toLocaleString();

            tr.innerHTML = `
                <td>
                    ${escapeHtml(
                        log.id
                    )}
                </td>

                <td class="token-cell">
                    ${escapeHtml(
                        log.token
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        log.ip
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        log.action
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        date
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        log.user_agent
                    )}
                </td>
            `;

            tbody.appendChild(tr);
        }

    } catch (error) {

        tbody.innerHTML =
            `<tr>
                <td colspan="6">
                    ${escapeHtml(
                        error.message
                    )}
                </td>
            </tr>`;
    }
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll() {

    await loadLicenses();
    await loadLogs();

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    clearJWT();

    location.href =
        "index.html";
}


/* =========================================================
   ESCAPING
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeJs(value) {

    return String(value ?? "")
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll("\n", "\\n")
        .replaceAll("\r", "\\r");
}


/* =========================================================
   PAGE STARTUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const loginForm =
            document.getElementById(
                "loginForm"
            );

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

            if (!getJWT()) {

                location.href =
                    "index.html";

                return;
            }

            showSection(
                "dashboard"
            );

            loadAll();
        }


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

    }
);
