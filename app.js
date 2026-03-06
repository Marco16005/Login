const USERS_KEY = "portal_users";
const SESSION_KEY = "portal_session";
const INTERIOR_PAGES = ["home.html", "profile.html", "settings.html", "help.html"];
const PUBLIC_PAGES = ["index.html", "register.html"];
const POKEMON_PAGE_SIZE = 30;

// Resolve current file name from URL path (defaults to login page).
function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

// Read registered users from localStorage.
function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
        return [];
    }
}

// Persist users array in localStorage.
function setUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Read active session object from localStorage.
function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

// Persist active session data.
function setSession(sessionData) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

// Clear session when user logs out.
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// Minimal session shape check for route protection.
function isSessionValid(session) {
    return Boolean(session && session.email && session.token);
}

// Generate a short session token (crypto first, fallback otherwise).
function createSessionToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    }

    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// Ensure a demo/admin account exists for quick testing.
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

// Simple client-side email format validation.
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Reuse existing inline error node or create one after input.
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

// Show validation error for one field.
function setFieldError(inputElement, message) {
    const errorNode = getErrorNode(inputElement);
    errorNode.textContent = message;
    errorNode.style.display = "block";
    inputElement.style.borderColor = "#dc3545";
}

// Clear validation error for one field.
function clearFieldError(inputElement) {
    const errorNode = getErrorNode(inputElement);
    errorNode.textContent = "";
    errorNode.style.display = "none";
    inputElement.style.borderColor = "#e1e1e1";
}

// Show form-level message (error/success).
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

// Clear form-level message if present.
function clearFormMessage(form) {
    const messageNode = form.querySelector(".form-message");
    if (messageNode) {
        messageNode.textContent = "";
    }
}

// Guard interior routes and redirect already-authenticated users away from login.
function protectInteriorPages() {
    const currentPage = getCurrentPage();
    const session = getSession();

    if (INTERIOR_PAGES.includes(currentPage) && !isSessionValid(session)) {
        window.location.href = "index.html";
        return;
    }

    if (currentPage === "index.html" && isSessionValid(session)) {
        window.location.href = "home.html";
    }
}

// Load reusable header/footer partials as plain HTML text.
async function fetchPartial(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load partial: ${path}`);
    }

    return response.text();
}

// Mark active nav link and inject user/session preview in interior header.
function applyInteriorHeaderState(headerHost, currentPage, session) {
    const activeLink = headerHost.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
        activeLink.classList.add("active");
    }

    const userName = headerHost.querySelector(".user-name");
    const tokenView = headerHost.querySelector(".session-token");

    if (userName) {
        userName.textContent = session.fullname;
    }

    if (tokenView) {
        tokenView.textContent = `Token: ${session.token.slice(0, 10).toUpperCase()}`;
    }
}

// Render shared header/footer based on current page type.
async function renderSharedLayout() {
    const currentPage = getCurrentPage();
    if (!INTERIOR_PAGES.includes(currentPage) && !PUBLIC_PAGES.includes(currentPage)) {
        return;
    }

    const headerHost = document.querySelector("#app-header");
    const footerHost = document.querySelector("#app-footer");

    try {
        if (footerHost) {
            footerHost.innerHTML = await fetchPartial("partials/site-footer.html");
        }

        if (!headerHost) {
            return;
        }

        if (INTERIOR_PAGES.includes(currentPage)) {
            const session = getSession();
            if (!isSessionValid(session)) {
                return;
            }

            headerHost.innerHTML = await fetchPartial("partials/interior-header.html");
            applyInteriorHeaderState(headerHost, currentPage, session);
            return;
        }

        if (PUBLIC_PAGES.includes(currentPage)) {
            headerHost.innerHTML = await fetchPartial("partials/public-header.html");
        }
    } catch (error) {
        console.error(error);
    }
}

// Global delegated logout handler (works with dynamically injected header).
function wireLogout() {
    document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const logoutLink = target.closest(".logout-link");
        if (!logoutLink) {
            return;
        }

        event.preventDefault();
        clearSession();
        window.location.href = "index.html";
    });
}

// Fill profile page fields from the current session user.
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

// Utility to display API labels with leading uppercase.
function capitalize(value) {
    if (!value) {
        return "";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

// Main Pokedex hydration flow: fetch, render, filter and background loading.
async function hydratePokemonPage() {
    if (getCurrentPage() !== "help.html") {
        return;
    }

    const loading = document.querySelector("#pokemon-loading");
    const main = document.querySelector("#pokemon-main");
    const image = document.querySelector("#pokemon-image");
    const id = document.querySelector("#pokemon-id");
    const name = document.querySelector("#pokemon-name");
    const types = document.querySelector("#pokemon-types");
    const abilities = document.querySelector("#pokemon-abilities");
    const height = document.querySelector("#pokemon-height");
    const weight = document.querySelector("#pokemon-weight");
    const baseExp = document.querySelector("#pokemon-base-exp");
    const stats = document.querySelector("#pokemon-stats");
    const catalog = document.querySelector("#pokemon-catalog");
    const list = document.querySelector("#pokemon-list");
    const filterId = document.querySelector("#filter-id");
    const filterName = document.querySelector("#filter-name");
    const filterType = document.querySelector("#filter-type");
    const filterClear = document.querySelector("#filter-clear");
    const jumpButton = document.querySelector("#pokemon-jump-btn");
    const note = document.querySelector("#pokemon-note");
    const error = document.querySelector("#pokemon-error");

    if (!loading || !main || !image || !id || !name || !types || !abilities || !height || !weight || !baseExp || !stats || !catalog || !list || !filterId || !filterName || !filterType || !filterClear || !jumpButton || !note || !error) {
        return;
    }

    // Runtime state for progressive loading and UI sync.
    let offset = 0;
    let hasMore = true;
    let totalCount = 0;
    let isLoadingAll = false;
    let selectedPokemonId = null;
    const allPokemon = [];
    const knownTypes = new Set();

    // Paint the top detail panel for the selected pokemon.
    function renderPokemonDetails(data) {
        const pokemonImage = data.sprites?.other?.["official-artwork"]?.front_default || data.sprites?.front_default;
        const pokemonName = capitalize(data.name);

        if (pokemonImage) {
            image.src = pokemonImage;
            image.alt = `${pokemonName} official artwork`;
            image.hidden = false;
        }

        id.textContent = `#${String(data.id).padStart(3, "0")}`;
        name.textContent = pokemonName;

        types.innerHTML = "";
        data.types.forEach((entry) => {
            const chip = document.createElement("span");
            chip.className = "pokemon-type-chip";
            chip.textContent = capitalize(entry.type.name);
            types.appendChild(chip);
        });

        abilities.innerHTML = "";
        data.abilities.forEach((entry) => {
            const li = document.createElement("li");
            li.textContent = capitalize(entry.ability.name.replace(/-/g, " "));
            abilities.appendChild(li);
        });

        // Height/weight from API come in decimeters/hectograms.
        height.textContent = `${(data.height / 10).toFixed(1)} m`;
        weight.textContent = `${(data.weight / 10).toFixed(1)} kg`;
        baseExp.textContent = String(data.base_experience ?? "N/A");

        stats.innerHTML = "";
        data.stats.forEach((entry) => {
            const statLabel = capitalize(entry.stat.name.replace(/-/g, " "));
            const value = entry.base_stat;
            // Normalize stat bars to a visual 0-100 track.
            const percentage = Math.min(100, Math.round((value / 180) * 100));

            const row = document.createElement("div");
            row.className = "pokemon-stat-row";

            const statName = document.createElement("span");
            statName.className = "pokemon-stat-name";
            statName.textContent = statLabel;

            const statTrack = document.createElement("div");
            statTrack.className = "pokemon-stat-track";

            const statFill = document.createElement("div");
            statFill.className = "pokemon-stat-fill";
            statFill.style.width = `${percentage}%`;

            const statValue = document.createElement("span");
            statValue.className = "pokemon-stat-value";
            statValue.textContent = String(value);

            statTrack.appendChild(statFill);
            row.appendChild(statName);
            row.appendChild(statTrack);
            row.appendChild(statValue);
            stats.appendChild(row);
        });
    }

    // Rebuild type filter options from loaded data while preserving selection.
    function updateTypeOptions() {
        const selected = filterType.value;
        const typeList = Array.from(knownTypes).sort();
        filterType.innerHTML = '<option value="">All types</option>';

        typeList.forEach((typeName) => {
            const option = document.createElement("option");
            option.value = typeName;
            option.textContent = capitalize(typeName);
            filterType.appendChild(option);
        });

        filterType.value = selected;
    }

    // Create one catalog card and wire selection behavior.
    function buildPokemonListCard(data, isInitiallyActive) {
        const card = document.createElement("article");
        card.className = `pokemon-list-card${isInitiallyActive ? " active" : ""}`;
        card.dataset.pokemonId = String(data.id);

        const pokemonId = document.createElement("p");
        pokemonId.className = "pokemon-list-id";
        pokemonId.textContent = `#${String(data.id).padStart(3, "0")}`;

        const sprite = document.createElement("img");
        sprite.src = data.sprites?.front_default || data.sprites?.other?.["official-artwork"]?.front_default || "";
        sprite.alt = `${capitalize(data.name)} sprite`;

        const pokemonName = document.createElement("h4");
        pokemonName.className = "pokemon-list-name";
        pokemonName.textContent = capitalize(data.name);

        const exp = document.createElement("p");
        exp.className = "pokemon-list-id";
        exp.textContent = `Base EXP: ${data.base_experience ?? "N/A"}`;

        const typeWrap = document.createElement("div");
        typeWrap.className = "pokemon-list-types";
        data.types.forEach((entry) => {
            const chip = document.createElement("span");
            chip.className = "pokemon-type-chip";
            chip.textContent = capitalize(entry.type.name);
            typeWrap.appendChild(chip);
        });

        card.appendChild(pokemonId);
        card.appendChild(sprite);
        card.appendChild(pokemonName);
        card.appendChild(exp);
        card.appendChild(typeWrap);

        card.addEventListener("click", () => {
            document.querySelectorAll(".pokemon-list-card.active").forEach((activeCard) => {
                activeCard.classList.remove("active");
            });
            card.classList.add("active");
            selectedPokemonId = data.id;
            renderPokemonDetails(data);
            main.scrollIntoView({ behavior: "smooth", block: "start" });
            updateJumpButtonState();
        });

        return card;
    }

    // Locate selected card in the currently rendered/filtered list.
    function findSelectedCard() {
        if (!selectedPokemonId) {
            return null;
        }

        return list.querySelector(`[data-pokemon-id="${selectedPokemonId}"]`);
    }

    // Adapt jump button label based on current list/selection state.
    function updateJumpButtonState() {
        const selectedCard = findSelectedCard();

        if (selectedCard) {
            jumpButton.textContent = "Go to last selected Pokemon";
            return;
        }

        if (list.children.length > 0) {
            jumpButton.textContent = "Go down to catalog";
            return;
        }

        jumpButton.textContent = "Catalog loading...";
    }

    // Apply id/name/type filters over loaded pokemon and rerender list.
    function applyFilters() {
        const idFilter = filterId.value.trim();
        const nameFilter = filterName.value.trim().toLowerCase();
        const typeFilter = filterType.value;

        const filtered = allPokemon.filter((pokemon) => {
            const matchesId = !idFilter || String(pokemon.id) === idFilter;
            const matchesName = !nameFilter || pokemon.name.includes(nameFilter);
            const matchesType = !typeFilter || pokemon.types.some((entry) => entry.type.name === typeFilter);
            return matchesId && matchesName && matchesType;
        });

        list.innerHTML = "";

        filtered.forEach((pokemon) => {
            const isActive = selectedPokemonId === pokemon.id;
            const card = buildPokemonListCard(pokemon, isActive);
            list.appendChild(card);
        });

        if (filtered.length === 0) {
            note.textContent = `Loaded ${allPokemon.length}${totalCount ? ` / ${totalCount}` : ""} · 0 matches for current filters.`;
            updateJumpButtonState();
            return;
        }

        const selectedStillVisible = filtered.some((pokemon) => pokemon.id === selectedPokemonId);
        if (!selectedStillVisible) {
            // Keep detail panel consistent if current selection is filtered out.
            selectedPokemonId = filtered[0].id;
            renderPokemonDetails(filtered[0]);
            list.firstElementChild?.classList.add("active");
        }

        const completionText = hasMore ? `${allPokemon.length}${totalCount ? ` / ${totalCount}` : ""}` : `${allPokemon.length} / ${totalCount}`;
        note.textContent = `Loaded ${completionText} · Showing ${filtered.length} Pokémon.`;
        updateJumpButtonState();
    }

    // Fetch one page from list endpoint and resolve details for each pokemon.
    async function fetchPokemonBatch(currentOffset) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${POKEMON_PAGE_SIZE}&offset=${currentOffset}`);
        if (!response.ok) {
            throw new Error("Could not fetch pokemon list");
        }

        const listData = await response.json();
        const details = await Promise.all(
            listData.results.map(async (pokemon) => {
                const detailResponse = await fetch(pokemon.url);
                if (!detailResponse.ok) {
                    throw new Error("Could not fetch pokemon details");
                }
                return detailResponse.json();
            })
        );

        return {
            details,
            totalCount: listData.count,
            hasMore: Boolean(listData.next),
        };
    }

    // Merge one fetched batch into app state and refresh dependent UI.
    function appendBatch(details) {
        details.forEach((pokemon) => {
            allPokemon.push(pokemon);
            pokemon.types.forEach((entry) => knownTypes.add(entry.type.name));
        });

        if (!selectedPokemonId && details.length > 0) {
            selectedPokemonId = details[0].id;
            renderPokemonDetails(details[0]);
        }

        updateTypeOptions();
        applyFilters();
    }

    // Swap loading skeleton for the actual pokemon UI.
    function showPokemonSections() {
        loading.hidden = true;
        main.hidden = false;
        catalog.hidden = false;
        error.hidden = true;
    }

    // Continue loading remaining pages in background after first render.
    async function loadRemainingBatchesInBackground() {
        if (isLoadingAll) {
            return;
        }

        isLoadingAll = true;

        try {
            while (hasMore) {
                const batch = await fetchPokemonBatch(offset);
                totalCount = batch.totalCount;
                offset += POKEMON_PAGE_SIZE;
                hasMore = batch.hasMore;

                appendBatch(batch.details);

                // Yield one frame between batches so the UI stays responsive.
                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            note.textContent = `Loaded all ${allPokemon.length} Pokémon. Use filters by id, name or type.`;
        } catch {
            if (allPokemon.length === 0) {
                loading.hidden = true;
                main.hidden = true;
                catalog.hidden = true;
                error.hidden = false;
                return;
            }

            // If partial data exists, keep UI usable and show non-blocking status.
            note.textContent = `Loaded ${allPokemon.length}${totalCount ? ` / ${totalCount}` : ""}. Background loading paused due to a network error.`;
        } finally {
            isLoadingAll = false;
        }
    }

    try {
        // Filters react immediately to user input.
        filterId.addEventListener("input", applyFilters);
        filterName.addEventListener("input", applyFilters);
        filterType.addEventListener("change", applyFilters);

        filterClear.addEventListener("click", () => {
            filterId.value = "";
            filterName.value = "";
            filterType.value = "";
            applyFilters();
        });

        // Jump action: return to selected card or go down to catalog.
        jumpButton.addEventListener("click", () => {
            const selectedCard = findSelectedCard();
            if (selectedCard) {
                selectedCard.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }

            catalog.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        // Fast first paint: render first 30 items, then load the rest asynchronously.
        const firstBatch = await fetchPokemonBatch(offset);
        totalCount = firstBatch.totalCount;
        offset += POKEMON_PAGE_SIZE;
        hasMore = firstBatch.hasMore;

        appendBatch(firstBatch.details);
        showPokemonSections();

        if (hasMore) {
            note.textContent = `Loaded ${allPokemon.length}${totalCount ? ` / ${totalCount}` : ""}. Loading remaining Pokémon in background...`;
            updateJumpButtonState();
            // Fire-and-forget background load to keep UI responsive.
            void loadRemainingBatchesInBackground();
        }
    } catch {
        loading.hidden = true;
        main.hidden = true;
        catalog.hidden = true;
        error.hidden = false;
    }
}

// Attach login behavior if login form is present.
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

        // Authenticate against local users list.
        const users = getUsers();
        const match = users.find((user) => user.email.toLowerCase() === email && user.password === password);

        if (!match) {
            setFormMessage(form, "Invalid credentials. Try again.");
            return;
        }

        setSession({
            fullname: match.fullname,
            email: match.email,
            token: createSessionToken(),
            loginAt: new Date().toISOString(),
        });

        window.location.href = "home.html";
    });
}

// Attach register behavior if register form is present.
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
        // Prevent duplicate accounts by email.
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

// Boot sequence for every page.
document.addEventListener("DOMContentLoaded", async () => {
    ensureSeedUser();
    protectInteriorPages();
    await renderSharedLayout();
    wireLogout();
    wireLoginForm();
    wireRegisterForm();
    hydrateProfilePage();
    await hydratePokemonPage();
});
