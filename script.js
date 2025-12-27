let story = {};
let current = "start";
let currentChapter = "chapter1";

const bg = document.getElementById("bg");
const char = document.getElementById("char");
const textBox = document.getElementById("text");
const choicesBox = document.getElementById("choices");

const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const saveStatus = document.getElementById("saveStatus");

/* ---------------------------
   TYPEWRITER
---------------------------- */
let typingTimer = null;
let typingIndex = 0;
let typingFullText = "";
let isTyping = false;

function stopTypewriter(showFull = false) {
    if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
    }
    if (showFull) textBox.textContent = typingFullText;
    isTyping = false;
}

function startTypewriter(text, cps = 45) { // chars per second
    stopTypewriter(false);
    typingFullText = String(text || "");
    typingIndex = 0;
    isTyping = true;
    textBox.textContent = "";

    const intervalMs = Math.max(10, Math.floor(1000 / cps));

    return new Promise(resolve => {
        typingTimer = setInterval(() => {
            typingIndex++;
            textBox.textContent = typingFullText.slice(0, typingIndex);

            if (typingIndex >= typingFullText.length) {
                stopTypewriter(false);
                resolve();
            }
        }, intervalMs);
    });
}

// Click/tap text area to skip typing immediately
textBox.addEventListener("click", () => {
    if (!isTyping) return;
    stopTypewriter(true);
    enableChoices();
});

/* ---------------------------
   FADE TRANSITIONS
---------------------------- */
function transitionImage(img, newSrc) {
    if (!img || !newSrc) return Promise.resolve();

    const resolvedSrc = new URL(newSrc, window.location.href).href;
    if (img.src && img.src === resolvedSrc) return Promise.resolve();

    return new Promise(resolve => {
        let done = false;

        const cleanup = () => {
            if (done) return;
            done = true;
            img.removeEventListener("transitionend", onFadeOutEnd);
            img.removeEventListener("load", onLoad);
            resolve();
        };

        const onLoad = () => {
            requestAnimationFrame(() => {
                img.classList.remove("fade-out");
                cleanup();
            });
        };

        const onFadeOutEnd = (e) => {
            if (e.propertyName !== "opacity") return;
            img.src = newSrc;
        };

        img.addEventListener("transitionend", onFadeOutEnd, { once: false });
        img.addEventListener("load", onLoad, { once: true });

        requestAnimationFrame(() => img.classList.add("fade-out"));

        // Fallback: if transition doesn't fire (first paint), still swap
        setTimeout(() => {
            if (img.classList.contains("fade-out") && (!img.src || img.src !== resolvedSrc)) {
                img.src = newSrc;
            }
        }, 60);

        // Hard fallback to avoid hanging
        setTimeout(cleanup, 1200);
    });
}

/* ---------------------------
   SAVE / LOAD (localStorage)
---------------------------- */
const SAVE_KEY = "vn_save_v1";

function setStatus(msg) {
    if (!saveStatus) return;
    saveStatus.textContent = msg || "";
    if (!msg) return;
    setTimeout(() => {
        if (saveStatus.textContent === msg) saveStatus.textContent = "";
    }, 1500);
}

function saveState() {
    try {
        const payload = {
            chapter: currentChapter,
            scene: current,
            savedAt: Date.now()
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        setStatus("Saved.");
    } catch (e) {
        setStatus("Save failed.");
        console.error(e);
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) {
            setStatus("No save found.");
            return;
        }
        const s = JSON.parse(raw);
        if (!s || !s.chapter || !s.scene) {
            setStatus("Save corrupted.");
            return;
        }
        loadChapter(s.chapter, s.scene);
        setStatus("Loaded.");
    } catch (e) {
        setStatus("Load failed.");
        console.error(e);
    }
}

if (saveBtn) saveBtn.addEventListener("click", saveState);
if (loadBtn) loadBtn.addEventListener("click", loadState);

/* ---------------------------
   LOAD CHAPTER
---------------------------- */
loadChapter(currentChapter);

function loadChapter(name, startScene = "start") {
    fetch(`chapters/${name}.json`)
        .then(r => {
            if (!r.ok) throw new Error(`Failed to load chapter: ${name}`);
            return r.json();
        })
        .then(d => {
            story = d;
            currentChapter = name;
            current = startScene || "start";
            showScene(current);
        })
        .catch(err => {
            console.error(err);
            textBox.textContent = "Error loading chapter.";
            choicesBox.innerHTML = "";
        });
}

/* ---------------------------
   CHOICES
---------------------------- */
function buildChoices(scene) {
    choicesBox.innerHTML = "";
    if (!scene || !scene.choices) return;

    scene.choices.forEach(c => {
        const b = document.createElement("button");
        b.textContent = c.text;
        b.disabled = true;

        b.onclick = () => {
            if (isTyping) return;
            if (c.nextChapter) {
                loadChapter(c.nextChapter);
            } else {
                showScene(c.next);
            }
        };

        choicesBox.appendChild(b);
    });
}

function enableChoices() {
    const btns = choicesBox.querySelectorAll("button");
    btns.forEach(b => (b.disabled = false));
}

/* ---------------------------
   SHOW SCENE
---------------------------- */
async function showScene(k) {
    const s = story[k];
    if (!s) return;

    current = k;

    stopTypewriter(false);
    buildChoices(s);

    const tasks = [];
    if (s.bg) tasks.push(transitionImage(bg, "assets/" + s.bg));
    if (s.char) tasks.push(transitionImage(char, "assets/" + s.char));
    await Promise.all(tasks);

    await startTypewriter(s.text || "");
    enableChoices();

    // Optional autosave:
    // saveState();
}
