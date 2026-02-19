const USERS_KEY = "portal_users";
const SESSION_KEY = "portal_session";

function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
        return [];
    }
}

function setUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

function setSession(sessionData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function ensureSeedUser() {
    const users = getUsers();
    const hasDefault = users.some((user) => user.email.toLowerCase() === "admin@example.com");

    if (!hasDefault) {
        users.push({
            fullname: "Admin User",
            email: "admin@example.com",
            password: "admin123",
            createdAt: new Date().toISOString(),
        });
        setUsers(users);
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorNode(inputElement) {
    const next = inputElement.nextElementSibling;
    if (next && next.classList.contains("error-text")) {
        return next;
    }

    const error = document.createElement("span");
    error.className = "error-text";
    inputElement.insertAdjacentElement("afterend", error);
    return error;
}

function setFieldError(inputElement, message) {
    const errorNode = getErrorNode(inputElement);
    errorNode.textContent = message;
    errorNode.style.display = "block";
    inputElement.style.borderColor = "#dc3545";
}

function clearFieldError(inputElement) {
    const errorNode = getErrorNode(inputElement);
    errorNode.textContent = "";
    errorNode.style.display = "none";
    inputElement.style.borderColor = "#e1e1e1";
}

function setFormMessage(form, message, isError = true) {
    let messageNode = form.querySelector(".form-message");
    if (!messageNode) {
        messageNode = document.createElement("p");
        messageNode.className = "form-message";
        form.appendChild(messageNode);
    }

    messageNode.textContent = message;
    messageNode.style.marginTop = "1rem";
    messageNode.style.textAlign = "center";
    messageNode.style.fontSize = "0.9rem";
    messageNode.style.color = isError ? "#dc3545" : "#28a745";
}

function clearFormMessage(form) {
    const messageNode = form.querySelector(".form-message");
    if (messageNode) {
        messageNode.textContent = "";
    }
}

function protectInteriorPages() {
    const protectedPages = ["home.html", "profile.html", "settings.html", "help.html"];
    const currentPage = getCurrentPage();
    const session = getSession();

    if (protectedPages.includes(currentPage) && !session) {
        window.location.href = "index.html";
        return;
    }

    if (currentPage === "index.html" && session) {
        window.location.href = "home.html";
    }
}

function wireLogout() {
    const logoutLinks = document.querySelectorAll(".logout-link");
    logoutLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            clearSession();
            window.location.href = "index.html";
        });
    });
}

function hydrateProfilePage() {
    if (getCurrentPage() !== "profile.html") {
        return;
    }

    const session = getSession();
    if (!session) {
        return;
    }

    const users = getUsers();
    const currentUser = users.find((user) => user.email.toLowerCase() === session.email.toLowerCase());
    if (!currentUser) {
        return;
    }

    const nameHeading = document.querySelector(".profile-name");
    const emailHeading = document.querySelector(".profile-email");
    const fullNameInput = document.querySelector("#profile-fullname");
    const emailInput = document.querySelector("#profile-email");

    if (nameHeading) nameHeading.textContent = currentUser.fullname;
    if (emailHeading) emailHeading.textContent = currentUser.email;
    if (fullNameInput) fullNameInput.value = currentUser.fullname;
    if (emailInput) emailInput.value = currentUser.email;
}

function wireLoginForm() {
    const form = document.querySelector("#login-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearFormMessage(form);

        const emailInput = document.querySelector("#email");
        const passwordInput = document.querySelector("#password");

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        let isValid = true;

        if (!isValidEmail(email)) {
            setFieldError(emailInput, "Please enter a valid email address");
            isValid = false;
        } else {
            clearFieldError(emailInput);
        }

        if (password.length < 8) {
            setFieldError(passwordInput, "Password must be at least 8 characters");
            isValid = false;
        } else {
            clearFieldError(passwordInput);
        }

        if (!isValid) {
            return;
        }

        const users = getUsers();
        const match = users.find((user) => user.email.toLowerCase() === email && user.password === password);

        if (!match) {
            setFormMessage(form, "Invalid credentials. Try again.");
            return;
        }

        setSession({
            fullname: match.fullname,
            email: match.email,
            loginAt: new Date().toISOString(),
        });

        window.location.href = "home.html";
    });
}

function wireRegisterForm() {
    const form = document.querySelector("#register-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearFormMessage(form);

        const fullNameInput = document.querySelector("#fullname");
        const emailInput = document.querySelector("#email");
        const passwordInput = document.querySelector("#password");
        const confirmPasswordInput = document.querySelector("#confirm-password");

        const fullname = fullNameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        let isValid = true;

        if (fullname.length < 3) {
            setFieldError(fullNameInput, "Full name must be at least 3 characters");
            isValid = false;
        } else {
            clearFieldError(fullNameInput);
        }

        if (!isValidEmail(email)) {
            setFieldError(emailInput, "Please enter a valid email address");
            isValid = false;
        } else {
            clearFieldError(emailInput);
        }

        if (password.length < 8) {
            setFieldError(passwordInput, "Password must be at least 8 characters");
            isValid = false;
        } else {
            clearFieldError(passwordInput);
        }

        if (confirmPassword !== password || !confirmPassword) {
            setFieldError(confirmPasswordInput, "Passwords do not match");
            isValid = false;
        } else {
            clearFieldError(confirmPasswordInput);
        }

        if (!isValid) {
            return;
        }

        const users = getUsers();
        const userExists = users.some((user) => user.email.toLowerCase() === email);

        if (userExists) {
            setFormMessage(form, "This email is already registered.");
            return;
        }

        const newUser = {
            fullname,
            email,
            password,
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        setUsers(users);

        console.log("Registered users JSON:", JSON.stringify(users, null, 2));
        setFormMessage(form, "Registration successful. Redirecting to login...", false);

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1200);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    ensureSeedUser();
    protectInteriorPages();
    wireLogout();
    wireLoginForm();
    wireRegisterForm();
    hydrateProfilePage();
});
