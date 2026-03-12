const USERS_KEY = "portal_users";
const SESSION_KEY = "portal_session";
const INTERIOR_PAGES = ["home.html", "profile.html", "settings.html", "help.html"];
const PUBLIC_PAGES = ["index.html", "register.html"];
// Number of pokemon fetched per API page for first paint + background loading.
const POKEMON_PAGE_SIZE = 30;

// Resolve current file name from URL path (defaults to login page).
function getCurrentPage() {
    const path = window.location.pathname;
    // Example: "/foo/help.html" -> "help.html".
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

// Read registered users from localStorage.
function getUsers() {
    try {
        // Return [] if key does not exist yet.
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
        // Session shape: { fullname, email, token, loginAt }.
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

// Persist active session data.
function setSession(sessionData) {
    // Keep writes centralized in case session schema changes later.
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

// Clear session when user logs out.
function clearSession() {
    // Remove only session key; keep users list untouched.
    localStorage.removeItem(SESSION_KEY);
}

// Minimal session shape check for route protection.
function isSessionValid(session) {
    return Boolean(session && session.email && session.token);
}

// Generate a short session token (crypto first, fallback otherwise).
function createSessionToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        // Trim UUID to a shorter UI-friendly token preview.
        return window.crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    }

    // Fallback for older browsers without crypto.randomUUID.
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

// Ensure a demo/admin account exists for quick testing.
function ensureSeedUser() {
    const users = getUsers();
    const hasDefault = users.some((user) => user.email.toLowerCase() === "admin@example.com");

    if (!hasDefault) {
        // One default account simplifies first-time demo/QA.
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
    // Place message right after field for easy visual association.
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
        // Keep message inside the same form to avoid global banners.
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
        // Hard redirect keeps interior content inaccessible without session.
        window.location.href = "index.html";
        return;
    }

    if (currentPage === "index.html" && isSessionValid(session)) {
        // Skip login screen when user is already authenticated.
        window.location.href = "home.html";
    }
}

// Load reusable header/footer partials as plain HTML text.
async function fetchPartial(path) {
    // Native fetch is enough because partials are static local files.
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
        // Show only a short preview token in UI.
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
            // Footer is shared by both public and interior pages.
            footerHost.innerHTML = await fetchPartial("partials/site-footer.html");
        }

        if (!headerHost) {
            return;
        }

        if (INTERIOR_PAGES.includes(currentPage)) {
            const session = getSession();
            if (!isSessionValid(session)) {
                // Do not render interior header state if session is invalid.
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
    // Email is used as unique user key in this demo app.
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
        // Exit silently if page structure changed or ids are missing.
        return;
    }

    // Runtime state for progressive loading and UI sync.
    let offset = 0;
    let hasMore = true;
    let totalCount = 0;
    let isLoadingAll = false;
    let selectedPokemonId = null;
    // Local cache to avoid refetching for filters.
    const allPokemon = [];
    const knownTypes = new Set();

    // Paint the top detail panel for the selected pokemon.
    function renderPokemonDetails(data) {
        // Prefer high-quality official artwork, then fallback sprite.
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
        // Types are rendered as chips for quick visual scan.
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
        // Convert each stat to a row with value + bar width.
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
        // Set -> Array lets us sort alphabetically for stable UX.
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
            // Keep only one active card at a time.
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

        // Data attribute gives O(n) DOM lookup without extra map structure.
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
            // ID exact match, name contains, type any-match.
            const matchesId = !idFilter || String(pokemon.id) === idFilter;
            const matchesName = !nameFilter || pokemon.name.includes(nameFilter);
            const matchesType = !typeFilter || pokemon.types.some((entry) => entry.type.name === typeFilter);
            return matchesId && matchesName && matchesType;
        });

        list.innerHTML = "";
        // Re-render list from filtered state for deterministic UI.

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
        // First call returns names + detail URLs + count + next.
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${POKEMON_PAGE_SIZE}&offset=${currentOffset}`);
        if (!response.ok) {
            throw new Error("Could not fetch pokemon list");
        }

        const listData = await response.json();
        // Resolve details in parallel for this batch.
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
            // Track all unique types discovered so far.
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
            // Prevent accidental double-start of background loader.
            return;
        }

        isLoadingAll = true;

        try {
            while (hasMore) {
                // Pull next chunk and merge it into local cache.
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
            // Reset all filter inputs to neutral state.
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
        // Initial load failed: hide sections and show compact error text.
        loading.hidden = true;
        main.hidden = true;
        catalog.hidden = true;
        error.hidden = false;
    }
}

// Simulate a turn-based Pokemon battle from API data and render step-by-step logs.
async function hydratePokemonBattleGame() {
    if (getCurrentPage() !== "help.html") {
        return;
    }

    const fighterOneInput = document.querySelector("#battle-fighter-1-input");
    const fighterTwoInput = document.querySelector("#battle-fighter-2-input");
    const loadButton = document.querySelector("#battle-load-fighters");
    const startButton = document.querySelector("#battle-start");
    const status = document.querySelector("#battle-status");
    const log = document.querySelector("#battle-log");
    const winnerWrap = document.querySelector("#battle-winner");
    const winnerImage = document.querySelector("#battle-winner-image");
    const winnerName = document.querySelector("#battle-winner-name");

    const fighterOneImage = document.querySelector("#battle-fighter-1-image");
    const fighterOneName = document.querySelector("#battle-fighter-1-name");
    const fighterOneHp = document.querySelector("#battle-fighter-1-hp");

    const fighterTwoImage = document.querySelector("#battle-fighter-2-image");
    const fighterTwoName = document.querySelector("#battle-fighter-2-name");
    const fighterTwoHp = document.querySelector("#battle-fighter-2-hp");

    if (!fighterOneInput || !fighterTwoInput || !loadButton || !startButton || !status || !log || !winnerWrap || !winnerImage || !winnerName || !fighterOneImage || !fighterOneName || !fighterOneHp || !fighterTwoImage || !fighterTwoName || !fighterTwoHp) {
        // Skip battle module if this page does not include the battle section.
        return;
    }

    let fighters = [null, null];
    let isBattleRunning = false;

    // Defense hint: encapsulate DOM logging so battle loop stays easy to read.
    function addBattleLog(text) {
        const item = document.createElement("li");
        item.textContent = text;
        log.appendChild(item);
        log.scrollTop = log.scrollHeight;
    }

    function randomInt(min, max) {
        // Inclusive random helper used for damage rolls.
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function sleep(ms) {
        // Small delay between turns improves readability of battle log.
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Fetch one pokemon by id or name for the battle setup.
    async function fetchBattlePokemon(query) {
        const normalized = query.trim().toLowerCase();
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalized)}`);
        if (!response.ok) {
            throw new Error(`Pokemon not found: ${query}`);
        }
        return response.json();
    }

    // Map API payload to a compact fighter state used by the simulator.
    function toBattleFighter(data) {
        const artwork = data.sprites?.other?.["official-artwork"]?.front_default || data.sprites?.front_default || "";
        const attackStat = data.stats.find((entry) => entry.stat.name === "attack")?.base_stat ?? 60;
        const specialAttackStat = data.stats.find((entry) => entry.stat.name === "special-attack")?.base_stat ?? 60;

        return {
            id: data.id,
            name: capitalize(data.name),
            image: artwork,
            // HP is normalized to 100% to keep battle output simple/comparable.
            hp: 100,
            attackStat,
            specialAttackStat,
            // Shield applies only to the next incoming hit.
            hasShield: false,
            // Track own turns to enforce cooldown rules.
            turnsTaken: 0,
            lastSpecialAttackTurn: -999,
            lastSpecialDefenseTurn: -999,
        };
    }

    function renderFighterPanel(index) {
        const fighter = fighters[index];
        if (!fighter) {
            return;
        }

        const imageNode = index === 0 ? fighterOneImage : fighterTwoImage;
        const nameNode = index === 0 ? fighterOneName : fighterTwoName;
        const hpNode = index === 0 ? fighterOneHp : fighterTwoHp;

        imageNode.src = fighter.image;
        imageNode.alt = `${fighter.name} image`;
        imageNode.hidden = !fighter.image;
        nameNode.textContent = fighter.name;
        hpNode.textContent = `HP: ${fighter.hp.toFixed(1)}%`;
    }

    function renderFighters() {
        renderFighterPanel(0);
        renderFighterPanel(1);
    }

    function chooseAction(attacker) {
        // Rules requested: special attack >=3 turns, special defense >=2 turns.
        const canUseSpecialAttack = attacker.turnsTaken >= 3 && attacker.turnsTaken - attacker.lastSpecialAttackTurn >= 3;
        const canUseSpecialDefense = attacker.turnsTaken >= 2 && attacker.turnsTaken - attacker.lastSpecialDefenseTurn >= 2;
        const roll = Math.random();

        if (canUseSpecialAttack && roll < 0.34) {
            return "special-attack";
        }

        if (canUseSpecialDefense && roll < 0.58) {
            return "special-defense";
        }

        return "basic-attack";
    }

    function resolveAttack(attacker, defender, action, turnNumber) {
        // Random miss chance applies to both normal and special attacks.
        const attackFailed = Math.random() < (action === "special-attack" ? 0.22 : 0.18);

        if (attackFailed) {
            addBattleLog(`Turn ${turnNumber} · ${attacker.name} used ${action} but missed.`);
            return;
        }

        const baseDamage = action === "special-attack"
            ? randomInt(18, 32) + Math.round(attacker.specialAttackStat / 25)
            : randomInt(10, 20) + Math.round(attacker.attackStat / 30);

        let finalDamage = baseDamage;

        // Defender shield can absorb damage, but shield itself can fail randomly.
        if (defender.hasShield) {
            const shieldFailed = Math.random() < 0.15;
            if (shieldFailed) {
                addBattleLog(`Turn ${turnNumber} · ${defender.name}'s special defense failed.`);
            } else {
                // Successful shield reduces incoming damage by 60%.
                finalDamage = Math.max(1, Math.round(baseDamage * 0.4));
                addBattleLog(`Turn ${turnNumber} · ${defender.name} blocked part of the damage.`);
            }

            defender.hasShield = false;
        }

        finalDamage = Math.max(1, finalDamage);
        defender.hp = Math.max(0, defender.hp - finalDamage);

        if (action === "special-attack") {
            // Cooldown checkpoint for next special attack use.
            attacker.lastSpecialAttackTurn = attacker.turnsTaken;
        }

        addBattleLog(`Turn ${turnNumber} · ${attacker.name} used ${action}, dealt ${finalDamage} damage, and left ${defender.name} at ${defender.hp.toFixed(1)}%.`);
    }

    function resolveDefense(attacker, turnNumber) {
        // Defense can also fail randomly as requested by rules.
        const defenseFailed = Math.random() < 0.2;
        if (defenseFailed) {
            addBattleLog(`Turn ${turnNumber} · ${attacker.name} tried special-defense, but it failed.`);
            return;
        }

        attacker.hasShield = true;
        // Cooldown checkpoint for next special defense use.
        attacker.lastSpecialDefenseTurn = attacker.turnsTaken;
        addBattleLog(`Turn ${turnNumber} · ${attacker.name} activated special-defense for the next hit.`);
    }

    async function loadFightersFromInputs() {
        const firstQuery = fighterOneInput.value.trim();
        const secondQuery = fighterTwoInput.value.trim();

        if (!firstQuery || !secondQuery) {
            // Force both contenders to avoid invalid battle state.
            status.textContent = "Enter both fighters (id or name) before loading.";
            return;
        }

        try {
            status.textContent = "Loading fighters from PokéAPI...";
            loadButton.disabled = true;
            startButton.disabled = true;

            const [firstData, secondData] = await Promise.all([
                // Both requests run in parallel to reduce waiting time.
                fetchBattlePokemon(firstQuery),
                fetchBattlePokemon(secondQuery),
            ]);

            fighters = [toBattleFighter(firstData), toBattleFighter(secondData)];
            log.innerHTML = "";
            winnerWrap.hidden = true;
            renderFighters();
            status.textContent = `${fighters[0].name} vs ${fighters[1].name} ready. Press Start battle.`;
            startButton.disabled = false;
        } catch {
            status.textContent = "Could not load one of the fighters. Verify id or name.";
        } finally {
            loadButton.disabled = false;
        }
    }

    async function runBattle() {
        if (isBattleRunning) {
            // Ignore extra clicks while battle loop is active.
            return;
        }

        if (!fighters[0] || !fighters[1]) {
            status.textContent = "Load both fighters first.";
            return;
        }

        isBattleRunning = true;
        loadButton.disabled = true;
        startButton.disabled = true;
        log.innerHTML = "";
        winnerWrap.hidden = true;

        // Reset combat state while keeping fighter identity and artwork.
        fighters = fighters.map((fighter) => ({
            ...fighter,
            hp: 100,
            hasShield: false,
            turnsTaken: 0,
            lastSpecialAttackTurn: -999,
            lastSpecialDefenseTurn: -999,
        }));
        renderFighters();

        let turnNumber = 1;
        let attackerIndex = 0;

        while (fighters[0].hp > 0 && fighters[1].hp > 0) {
            const defenderIndex = attackerIndex === 0 ? 1 : 0;
            const attacker = fighters[attackerIndex];
            const defender = fighters[defenderIndex];

            status.textContent = `Turn ${turnNumber}: ${attacker.name}'s move.`;
            const action = chooseAction(attacker);

            if (action === "special-defense") {
                resolveDefense(attacker, turnNumber);
            } else {
                resolveAttack(attacker, defender, action, turnNumber);
            }

            attacker.turnsTaken += 1;
            // Turn counter drives special move availability windows.
            renderFighters();

            if (defender.hp <= 0) {
                break;
            }

            turnNumber += 1;
            attackerIndex = defenderIndex;
            await sleep(900);
        }

        const winner = fighters[0].hp > 0 ? fighters[0] : fighters[1];
        // Final winner panel requested in requirements.
        winnerImage.src = winner.image;
        winnerImage.alt = `${winner.name} winner image`;
        winnerName.textContent = `${winner.name} is the winner!`;
        winnerWrap.hidden = false;
        status.textContent = `Battle finished in ${turnNumber} turns.`;
        addBattleLog(`Battle result · ${winner.name} wins.`);

        isBattleRunning = false;
        loadButton.disabled = false;
        startButton.disabled = false;
    }

    loadButton.addEventListener("click", () => {
        // Fire-and-forget with internal error/status handling.
        void loadFightersFromInputs();
    });

    startButton.addEventListener("click", () => {
        // Fire-and-forget to keep click handler synchronous.
        void runBattle();
    });
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
    // Startup order matters: auth guard first, then shared layout, then page modules.
    ensureSeedUser();
    protectInteriorPages();
    await renderSharedLayout();
    wireLogout();
    wireLoginForm();
    wireRegisterForm();
    hydrateProfilePage();
    await hydratePokemonPage();
    await hydratePokemonBattleGame();
});
