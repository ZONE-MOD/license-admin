const API_URL = "https://license-api.amyratfy8.workers.dev";

const JWT_KEY = "admin_jwt";


/* =========================
   Helpers
========================= */

function getJWT() {
  return sessionStorage.getItem(JWT_KEY);
}


function setJWT(token) {
  sessionStorage.setItem(JWT_KEY, token);
}


function clearJWT() {
  sessionStorage.removeItem(JWT_KEY);
}


/* =========================
   API
========================= */

async function api(path, options = {}) {

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const jwt = getJWT();

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  let response;

  try {

    response = await fetch(
      API_URL + path,
      {
        ...options,
        headers
      }
    );

  } catch (error) {

    throw new Error(
      "اتصال به Worker برقرار نشد.\n" +
      "URL:\n" +
      API_URL
    );
  }


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
}


/* =========================
   Login
========================= */

async function login(event) {

  event.preventDefault();


  const passwordInput =
    document.getElementById("password");

  const loginButton =
    document.getElementById("loginButton");

  const message =
    document.getElementById("loginMessage");


  const password =
    passwordInput.value;


  if (!password) {

    message.textContent =
      "Password را وارد کنید.";

    return;
  }


  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";
  message.textContent = "";


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


    if (!result.ok) {

      throw new Error(
        result.error ||
        "Login failed."
      );
    }


    if (!result.token) {

      throw new Error(
        "Worker توکن JWT برنگرداند."
      );
    }


    setJWT(result.token);


    message.style.color = "#21c77a";
    message.textContent =
      "Login successful. Opening dashboard...";


    setTimeout(() => {

      window.location.href =
        "dashboard.html";

    }, 300);


  } catch (error) {

    clearJWT();

    message.style.color = "#ff6b6b";

    message.textContent =
      error.message ||
      "Login failed.";

  } finally {

    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
}


/* =========================
   Start
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const form =
      document.getElementById("loginForm");


    if (!form) {
      return;
    }


    form.addEventListener(
      "submit",
      login
    );

  }
);
