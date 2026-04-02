import "../vendor/libcss/src/scss/libcss.scss";
import "./styles/login-lab.css";

const DEMO_USERNAME = "demo-user";
const DEMO_PASSWORD = "demo-pass";

function toggleDashboardVisibility(isVisible: boolean): void {
  const dashboard = document.getElementById("dashboard");
  if (!dashboard) {
    return;
  }

  dashboard.toggleAttribute("hidden", !isVisible);
}

function toggleErrorVisibility(isVisible: boolean): void {
  const error = document.getElementById("login-error");
  if (!error) {
    return;
  }

  error.toggleAttribute("hidden", !isVisible);
}

function initializeLoginLab(): void {
  const form = document.getElementById("login-form");
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const usernameValue = formData.get("username");
    const passwordValue = formData.get("password");
    const username = typeof usernameValue === "string" ? usernameValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";

    const loginSucceeded = username === DEMO_USERNAME && password === DEMO_PASSWORD;

    toggleDashboardVisibility(loginSucceeded);
    toggleErrorVisibility(!loginSucceeded);
  });
}

initializeLoginLab();
