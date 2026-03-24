// === App Version - increment to force refresh on mobile ===
const APP_VERSION = '5';
const storedVersion = localStorage.getItem('bm_version');
if (storedVersion && storedVersion !== APP_VERSION) {
    localStorage.setItem('bm_version', APP_VERSION);
    location.reload(true);
} else {
    localStorage.setItem('bm_version', APP_VERSION);
}

// === Score History (localStorage) ===
function isDesktop() {
    return /Windows/i.test(navigator.userAgent) && !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function trackError(n1, n2) {
    const errors = JSON.parse(localStorage.getItem('bm_errors') || '{}');
    const key = `${n1}x${n2}`;
    errors[key] = (errors[key] || 0) + 1;
    localStorage.setItem('bm_errors', JSON.stringify(errors));
    // Sync to Firebase
    syncErrorsToFirebase(errors);
}

function getStruggleTables() {
    const errors = JSON.parse(localStorage.getItem('bm_errors') || '{}');
    if (Object.keys(errors).length === 0) return null;
    
    // Count errors per table
    const tableCounts = {};
    for (const [key, count] of Object.entries(errors)) {
        const [a, b] = key.split('x').map(Number);
        tableCounts[a] = (tableCounts[a] || 0) + count;
        if (a !== b) tableCounts[b] = (tableCounts[b] || 0) + count;
    }
    
    // Top 3 hardest tables
    const tables = Object.entries(tableCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    // Top 5 hardest specific multiplications
    const hardest = Object.entries(errors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    return { tables, hardest };
}

function saveSession(mode, finalScore, bestStreak) {
    const session = {
        date: new Date().toISOString(),
        mode: mode,
        score: finalScore,
        streak: bestStreak
    };
    
    // Save locally
    const history = JSON.parse(localStorage.getItem('bm_scores') || '[]');
    history.unshift(session);
    if (history.length > 50) history.length = 50;
    localStorage.setItem('bm_scores', JSON.stringify(history));
    
    // Sync to Firebase
    pushSessionToFirebase(session);
    
    if (isDesktop()) renderHistory();
}

function renderHistory() {
    const panel = document.getElementById('historyPanel');
    if (!panel || !isDesktop()) return;
    
    panel.classList.remove('hidden');
    const list = document.getElementById('historyList');
    
    // If Firebase is available, load from there (all devices' scores)
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
        renderHistoryFromFirebase(panel, list);
        return;
    }
    
    // Fallback: local only
    renderHistoryLocal(list);
}

function renderHistoryLocal(list) {
    const history = JSON.parse(localStorage.getItem('bm_scores') || '[]');
    const errors = JSON.parse(localStorage.getItem('bm_errors') || '{}');
    list.innerHTML = buildHistoryHTML(history, errors);
}

function renderHistoryFromFirebase(panel, list) {
    list.innerHTML = '<div class="history-empty">Chargement...</div>';
    
    // Listen for real-time updates on scores
    firebaseDB.ref('scores').orderByChild('date').limitToLast(50).on('value', snap => {
        const sessions = [];
        snap.forEach(child => sessions.push(child.val()));
        sessions.reverse(); // newest first
        
        // Also get errors
        firebaseDB.ref('errors').once('value', errSnap => {
            const errors = errSnap.val() || {};
            list.innerHTML = buildHistoryHTML(sessions, errors);
        });
    });
}

function buildHistoryHTML(history, errors) {
    let html = '';
    
    // Struggle analysis from errors object
    if (errors && Object.keys(errors).length > 0) {
        const tableCounts = {};
        for (const [key, count] of Object.entries(errors)) {
            const [a, b] = key.split('x').map(Number);
            tableCounts[a] = (tableCounts[a] || 0) + count;
            if (a !== b) tableCounts[b] = (tableCounts[b] || 0) + count;
        }
        const tables = Object.entries(tableCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const hardest = Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        html += '<div class="struggle-section">';
        html += '<div class="struggle-title">😰 Tables difficiles</div>';
        html += '<div class="struggle-tags">';
        tables.forEach(([table, count]) => {
            html += `<span class="struggle-tag">×${table} <small>(${count})</small></span>`;
        });
        html += '</div>';
        html += '<div class="struggle-subtitle">Multiplications les plus ratées</div>';
        html += '<div class="struggle-tags">';
        hardest.forEach(([key, count]) => {
            html += `<span class="struggle-tag hard">${key.replace('x', '×')} <small>(${count})</small></span>`;
        });
        html += '</div></div>';
    }
    
    if (!history || history.length === 0) {
        html += '<div class="history-empty">Aucune session encore. Joue une partie !</div>';
    } else {
        html += history.map(h => {
            const d = new Date(h.date);
            const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `<div class="history-item">
                <span class="history-date">${dateStr} ${timeStr}</span>
                <span class="history-mode">${h.mode}</span>
                <span class="history-score">Score: ${h.score} | 🔥${h.streak}</span>
            </div>`;
        }).join('');
    }
    
    return html;
}

// === Firebase Sync Functions ===
function pushSessionToFirebase(session) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    try {
        firebaseDB.ref('scores').push(session);
    } catch (e) {
        console.warn('Firebase push failed:', e);
    }
}

function syncErrorsToFirebase(localErrors) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    try {
        // Merge with existing Firebase errors (increment, don't overwrite)
        firebaseDB.ref('errors').once('value', snap => {
            const remote = snap.val() || {};
            const merged = { ...remote };
            for (const [key, count] of Object.entries(localErrors)) {
                // Use the max of local and remote to avoid double-counting
                merged[key] = Math.max(merged[key] || 0, count);
            }
            firebaseDB.ref('errors').set(merged);
        });
    } catch (e) {
        console.warn('Firebase error sync failed:', e);
    }
}

// Audio context for sound effects
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    
    // Resume context if suspended (iOS requirement)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
    else if (type === 'correct') {
        // Victory fanfare - bright and celebratory
        const notes = [523, 659, 784, 1047, 1319]; // C5, E5, G5, C6, E6
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0, now + i * 0.07);
            gain.gain.linearRampToValueAtTime(0.25, now + i * 0.07 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.35);
            osc.start(now + i * 0.07);
            osc.stop(now + i * 0.07 + 0.35);
        });
        // Sparkle effect
        setTimeout(() => {
            const sparkle = audioCtx.createOscillator();
            const sparkleGain = audioCtx.createGain();
            sparkle.type = 'triangle';
            sparkle.connect(sparkleGain);
            sparkleGain.connect(audioCtx.destination);
            sparkle.frequency.setValueAtTime(2500, audioCtx.currentTime);
            sparkle.frequency.exponentialRampToValueAtTime(4000, audioCtx.currentTime + 0.2);
            sparkleGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            sparkleGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            sparkle.start(audioCtx.currentTime);
            sparkle.stop(audioCtx.currentTime + 0.2);
        }, 300);
    }
    else if (type === 'wrong') {
        // Sad descending tone - clear "wrong" sound
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        // First note
        osc1.frequency.setValueAtTime(350, now);
        osc1.frequency.exponentialRampToValueAtTime(200, now + 0.25);
        osc2.frequency.setValueAtTime(350, now);
        osc2.frequency.exponentialRampToValueAtTime(200, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
    }
    else if (type === 'start') {
        const melody = [523, 659, 784, 880, 1047];
        melody.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0, now + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.15);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.15);
        });
    }
}

const settings = document.getElementById('settings');
const game = document.getElementById('game');
const startBtn = document.getElementById('startBtn');
const maxNumberSelect = document.getElementById('maxNumber');
const num1El = document.getElementById('num1');
const num2El = document.getElementById('num2');
const answerDisplay = document.getElementById('answerDisplay');
const submitBtn = document.getElementById('submitBtn');
const feedback = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const newGameBtn = document.getElementById('newGameBtn');
const backBtn = document.getElementById('backBtn');
const numButtons = document.querySelectorAll('.num-btn');
const robot = document.getElementById('robot');
const timerFill = document.getElementById('timerFill');
const challengesPanel = document.getElementById('challengesPanel');
const challengesList = document.getElementById('challengesList');
const challengeModeLabel = document.getElementById('challengeModeLabel');
const challengeTableNum = document.getElementById('challengeTableNum');
const masteredPanel = document.getElementById('masteredPanel');
const masteredList = document.getElementById('masteredList');
const sidePanels = document.querySelector('.side-panels');

let score = 0;
let streak = 0;
let bestStreak = 0;
let currentAnswer = 0;
let maxNumber = 10;
let userInput = '';
let currentNum1 = 0;
let currentNum2 = 0;
let timer = null;
let timeLeft = 11;
const TIMER_DURATION = 11;
let challenges = []; // Array of {n1, n2, answer}
let currentIsChallenge = false;
let currentChallengeIndex = -1;
let challengeTableMode = 0; // 0 = normal mode, 6-9 = specific table
let mastered = []; // Array of multipliers already mastered in challenge mode
const tableButtons = document.querySelectorAll('.btn-table');

// Round mode
let totalQuestions = 10;
let currentQuestion = 0;
let correctAnswers = 0;
let globalTimer = null;
let globalTimeLeft = 0;
const TIME_PER_10 = 90; // 1:30 per 10 questions
const roundButtons = document.querySelectorAll('.btn-round');
const questionCounter = document.getElementById('questionCounter');
const currentQEl = document.getElementById('currentQ');
const totalQEl = document.getElementById('totalQ');
const globalTimerBar = document.getElementById('globalTimerBar');
const globalTimerFill = document.getElementById('globalTimerFill');
const globalTimerText = document.getElementById('globalTimerText');
const endScreen = document.getElementById('endScreen');
const endTitle = document.getElementById('endTitle');
const endScore = document.getElementById('endScore');
const endCorrect = document.getElementById('endCorrect');
const endStreak = document.getElementById('endStreak');
const endStars = document.getElementById('endStars');
const replayBtn = document.getElementById('replayBtn');
const endMenuBtn = document.getElementById('endMenuBtn');

// Show history on desktop only
if (isDesktop()) renderHistory();

// BABYMONSTER song references + Korean encouragement!
const correctMessages = [
    'SHEESH! 🔥',
    'BATTER UP! ⚾',
    'FOREVER! 💜',
    '대박! Daebak! Incroyable! 🌟',
    '잘했어! Jalhesseo! Bien joué! 💖',
    '최고! Chego! La meilleure! 👑',
    '화이팅! Hwaiting! Courage! 💪',
    '완벽해! Wanbyeokae! Parfait! ✨',
    'LIKE THAT! 💖',
    'CLIK CLIK CLIK! 📸',
    '멋져! Meotjyeo! Génial! 🔥',
    '천재! Cheonjae! Génie! 🧠'
];
const wrongMessages = [
    '괜찮아~ Gwaenchana~ Ça va~ 💭',
    '다시! Dasi! Encore! 🎤',
    '힘내! Himnae! Courage! 💪',
    '아깝다~ Akkapda~ Presque~ 😅'
];

startBtn.addEventListener('click', () => {
    initAudio();
    playSound('start');
    challengeTableMode = 0;
    startGame();
});

tableButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        playSound('start');
        challengeTableMode = parseInt(btn.dataset.table);
        startGame();
    });
});
submitBtn.addEventListener('click', checkAnswer);
newGameBtn.addEventListener('click', goToMenu);
backBtn.addEventListener('click', goToMenu);

roundButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        roundButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        totalQuestions = parseInt(btn.dataset.rounds);
    });
});

replayBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    initAudio();
    playSound('start');
    startGame();
});

endMenuBtn.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    goToMenu();
});

function goToMenu() {
    stopTimer();
    stopGlobalTimer();
    
    // Save session if player actually played
    if (score > 0) {
        const mode = challengeTableMode > 0 ? `Défi ×${challengeTableMode}` : `Tables 1-${maxNumber}`;
        saveSession(mode, score, bestStreak);
    }
    
    settings.classList.remove('hidden');
    game.classList.add('hidden');
    endScreen.classList.add('hidden');
    newGameBtn.classList.add('hidden');
    challengesPanel.classList.remove('visible');
    masteredPanel.classList.remove('visible');
    sidePanels.classList.remove('visible');
    challengeModeLabel.classList.add('hidden');
    questionCounter.classList.add('hidden');
    globalTimerBar.classList.add('hidden');
    document.body.classList.remove('challenge-theme');
    score = 0;
    streak = 0;
    bestStreak = 0;
    currentQuestion = 0;
    correctAnswers = 0;
    challenges = [];
    mastered = [];
}

numButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        const num = btn.dataset.num;
        const action = btn.dataset.action;
        
        if (num !== undefined) {
            if (userInput.length < 3) {
                userInput += num;
                updateDisplay();
            }
        } else if (action === 'clear') {
            userInput = '';
            updateDisplay();
        } else if (action === 'back') {
            userInput = userInput.slice(0, -1);
            updateDisplay();
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (game.classList.contains('hidden')) return;
    
    if (e.key >= '0' && e.key <= '9') {
        if (userInput.length < 3) {
            userInput += e.key;
            updateDisplay();
        }
    } else if (e.key === 'Backspace') {
        userInput = userInput.slice(0, -1);
        updateDisplay();
    } else if (e.key === 'Enter') {
        checkAnswer();
    } else if (e.key === 'Escape') {
        userInput = '';
        updateDisplay();
    }
});

function updateDisplay() {
    answerDisplay.textContent = userInput;
    if (userInput === '') {
        answerDisplay.classList.add('empty');
    } else {
        answerDisplay.classList.remove('empty');
    }
}

function startGame() {
    maxNumber = parseInt(maxNumberSelect.value);
    score = 0;
    streak = 0;
    bestStreak = 0;
    userInput = '';
    currentQuestion = 0;
    correctAnswers = 0;
    challenges = [];
    mastered = [];
    updateChallengesPanel();
    updateMasteredPanel();
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    settings.classList.add('hidden');
    endScreen.classList.add('hidden');
    game.classList.remove('hidden');
    feedback.textContent = '';
    feedback.className = 'feedback';
    
    if (challengeTableMode > 0) {
        challengeModeLabel.classList.remove('hidden');
        challengeTableNum.textContent = challengeTableMode;
        document.body.classList.add('challenge-theme');
        questionCounter.classList.add('hidden');
        globalTimerBar.classList.add('hidden');
    } else {
        challengeModeLabel.classList.add('hidden');
        document.body.classList.remove('challenge-theme');
        // Show round info
        questionCounter.classList.remove('hidden');
        totalQEl.textContent = totalQuestions;
        currentQEl.textContent = '1';
        // Start global timer
        globalTimerBar.classList.remove('hidden');
        globalTimeLeft = (totalQuestions / 10) * TIME_PER_10;
        startGlobalTimer();
    }
    
    updateDisplay();
    generateQuestion();
}

function generateQuestion() {
    stopTimer();
    currentIsChallenge = false;
    
    // 30% chance to pick from challenges if there are any
    if (challenges.length > 0 && Math.random() < 0.3) {
        const challengeIndex = Math.floor(Math.random() * challenges.length);
        const challenge = challenges[challengeIndex];
        currentNum1 = challenge.n1;
        currentNum2 = challenge.n2;
        currentAnswer = challenge.answer;
        currentIsChallenge = true;
        currentChallengeIndex = challengeIndex;
        highlightChallenge(challengeIndex);
    } else if (challengeTableMode > 0) {
        // Challenge table mode: fixed table, random multiplier 1-12 (skip mastered)
        const remaining = [];
        for (let i = 1; i <= 12; i++) {
            if (!mastered.includes(i)) remaining.push(i);
        }
        
        if (remaining.length === 0) {
            // All mastered! TABLE MASTER celebration
            stopTimer();
            saveSession(`Défi ×${challengeTableMode} ✅`, score, bestStreak);
            spawnTableMasterCelebration();
            newGameBtn.classList.remove('hidden');
            return;
        }
        
        currentNum1 = challengeTableMode;
        currentNum2 = remaining[Math.floor(Math.random() * remaining.length)];
        currentAnswer = currentNum1 * currentNum2;
        clearChallengeHighlight();
    } else {
        currentNum1 = Math.floor(Math.random() * maxNumber) + 1;
        currentNum2 = Math.floor(Math.random() * maxNumber) + 1;
        currentAnswer = currentNum1 * currentNum2;
        clearChallengeHighlight();
    }
    
    num1El.textContent = currentNum1;
    num2El.textContent = currentNum2;
    userInput = '';
    updateDisplay();
    startTimer();
}

function highlightChallenge(index) {
    const items = challengesList.querySelectorAll('.challenge-item');
    items.forEach((item, i) => {
        if (i === index) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function clearChallengeHighlight() {
    const items = challengesList.querySelectorAll('.challenge-item');
    items.forEach(item => item.classList.remove('active'));
}

function checkAnswer() {
    stopTimer();
    const userAnswer = parseInt(userInput);
    
    if (isNaN(userAnswer) || userInput === '') {
        feedback.textContent = 'ENTRE UN NOMBRE !';
        feedback.className = 'feedback';
        startTimer();
        return;
    }
    
    if (userAnswer === currentAnswer) {
        playSound('correct');
        robot.className = 'robot happy';
        setTimeout(() => robot.className = 'robot', 800);
        score++;
        streak++;
        correctAnswers++;
        if (streak > bestStreak) bestStreak = streak;
        scoreEl.textContent = score;
        streakEl.textContent = streak;
        feedback.textContent = correctMessages[Math.floor(Math.random() * correctMessages.length)];
        feedback.className = 'feedback correct';
        
        // Check if this was a challenge and remove it
        removeChallengeIfExists(currentNum1, currentNum2);
        
        // In challenge table mode, add to mastered
        if (challengeTableMode > 0) {
            addToMastered(currentNum2);
        }
        
        spawnConfetti();
        
        setTimeout(() => advanceQuestion(), 800);
    } else {
        handleWrongAnswer();
    }
}

function advanceQuestion() {
    if (challengeTableMode === 0) {
        currentQuestion++;
        currentQEl.textContent = Math.min(currentQuestion + 1, totalQuestions);
        
        if (currentQuestion >= totalQuestions) {
            endRound();
            return;
        }
    }
    generateQuestion();
}

function endRound() {
    stopTimer();
    stopGlobalTimer();
    
    const mode = challengeTableMode > 0 ? `Défi ×${challengeTableMode}` : `Tables 1-${maxNumber} (${totalQuestions}Q)`;
    saveSession(mode, score, bestStreak);
    
    // Show end screen
    game.classList.add('hidden');
    endScreen.classList.remove('hidden');
    
    endScore.textContent = score;
    endCorrect.textContent = `${correctAnswers}/${totalQuestions}`;
    endStreak.textContent = `🔥 ${bestStreak}`;
    
    // Stars based on percentage
    const pct = correctAnswers / totalQuestions;
    if (pct >= 0.9) {
        endTitle.textContent = '완벽해! Parfait!';
        endStars.textContent = '⭐⭐⭐';
        spawnConfetti();
        setTimeout(() => spawnConfetti(), 400);
    } else if (pct >= 0.7) {
        endTitle.textContent = '잘했어! Bien joué!';
        endStars.textContent = '⭐⭐';
        spawnConfetti();
    } else if (pct >= 0.5) {
        endTitle.textContent = '힘내! Courage!';
        endStars.textContent = '⭐';
    } else {
        endTitle.textContent = '다시! On recommence!';
        endStars.textContent = '';
    }
}

function startGlobalTimer() {
    updateGlobalTimerDisplay();
    globalTimer = setInterval(() => {
        globalTimeLeft -= 1;
        updateGlobalTimerDisplay();
        
        if (globalTimeLeft <= 0) {
            stopGlobalTimer();
            stopTimer();
            feedback.textContent = '⏰ TEMPS ÉCOULÉ!';
            feedback.className = 'feedback wrong';
            setTimeout(() => endRound(), 1000);
        }
    }, 1000);
}

function stopGlobalTimer() {
    if (globalTimer) {
        clearInterval(globalTimer);
        globalTimer = null;
    }
}

function updateGlobalTimerDisplay() {
    const totalTime = (totalQuestions / 10) * TIME_PER_10;
    const pct = (globalTimeLeft / totalTime) * 100;
    globalTimerFill.style.width = pct + '%';
    
    const mins = Math.floor(globalTimeLeft / 60);
    const secs = globalTimeLeft % 60;
    globalTimerText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (globalTimeLeft <= 15) {
        globalTimerFill.className = 'global-timer-fill critical';
    } else if (globalTimeLeft <= 30) {
        globalTimerFill.className = 'global-timer-fill warning';
    } else {
        globalTimerFill.className = 'global-timer-fill';
    }
}

function handleWrongAnswer() {
    playSound('wrong');
    robot.className = 'robot sad';
    setTimeout(() => robot.className = 'robot', 1500);
    streak = 0;
    streakEl.textContent = streak;
    feedback.textContent = wrongMessages[Math.floor(Math.random() * wrongMessages.length)] + ` (${currentAnswer})`;
    feedback.className = 'feedback wrong';
    
    // Track error for struggle analysis
    trackError(currentNum1, currentNum2);
    
    // Add to challenges if not already there
    addToChallenge(currentNum1, currentNum2, currentAnswer);
    
    setTimeout(() => advanceQuestion(), 1500);
}

function addToChallenge(n1, n2, answer) {
    // Check if already exists
    const exists = challenges.some(c => 
        (c.n1 === n1 && c.n2 === n2) || (c.n1 === n2 && c.n2 === n1)
    );
    
    if (!exists) {
        challenges.push({ n1, n2, answer });
        updateChallengesPanel();
    }
}

function removeChallengeIfExists(n1, n2) {
    const index = challenges.findIndex(c => 
        (c.n1 === n1 && c.n2 === n2) || (c.n1 === n2 && c.n2 === n1)
    );
    
    if (index !== -1) {
        // Mark as solved with animation
        const items = challengesList.querySelectorAll('.challenge-item');
        if (items[index]) {
            items[index].classList.add('solved');
        }
        
        // Remove after animation
        setTimeout(() => {
            challenges.splice(index, 1);
            updateChallengesPanel();
        }, 500);
        
        // Extra celebration for solving a challenge!
        playSound('correct');
    }
}

function updateChallengesPanel() {
    if (challenges.length === 0) {
        challengesPanel.classList.remove('visible');
        updateSidePanels();
        return;
    }
    
    challengesPanel.classList.add('visible');
    challengesList.innerHTML = challenges.map(c => 
        `<div class="challenge-item">${c.n1}×${c.n2}</div>`
    ).join('');
    updateSidePanels();
}

function addToMastered(multiplier) {
    if (!mastered.includes(multiplier)) {
        mastered.push(multiplier);
        mastered.sort((a, b) => a - b);
        updateMasteredPanel();
    }
}

function updateMasteredPanel() {
    if (mastered.length === 0 || challengeTableMode === 0) {
        masteredPanel.classList.remove('visible');
        updateSidePanels();
        return;
    }
    
    masteredPanel.classList.add('visible');
    masteredList.innerHTML = mastered.map(m => 
        `<div class="mastered-item">${challengeTableMode}×${m}</div>`
    ).join('');
    updateSidePanels();
}

function updateSidePanels() {
    const hasVisible = masteredPanel.classList.contains('visible') || challengesPanel.classList.contains('visible');
    sidePanels.classList.toggle('visible', hasVisible);
}

function startTimer() {
    timeLeft = TIMER_DURATION;
    timerFill.style.width = '100%';
    timerFill.className = 'timer-fill';
    
    timer = setInterval(() => {
        timeLeft -= 0.1;
        const percent = (timeLeft / TIMER_DURATION) * 100;
        timerFill.style.width = percent + '%';
        
        if (timeLeft <= 3) {
            timerFill.className = 'timer-fill critical';
        } else if (timeLeft <= 5) {
            timerFill.className = 'timer-fill warning';
        }
        
        if (timeLeft <= 0) {
            stopTimer();
            // Time's up - treat as wrong answer
            feedback.textContent = '⏰ TEMPS ÉCOULÉ!';
            feedback.className = 'feedback wrong';
            handleWrongAnswer();
        }
    }, 100);
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

function spawnConfetti() {
    const emojis = ['💖', '⭐', '✨', '💫', '🔥', '💜', '🖤', '💗', '🌟', '💕'];
    
    // Random BABYMONSTER gif celebration
    const gifs = [
        'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXp4dmhucmoxcXRnZjZiNHZzbzEzZjFyOXRhbDljYmxoem1iZjR1OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Y97iZVAYoSYfjnYxZY/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MTg3bGh2dnVwdXc1cmUxcTV1d2ZuMzRkdWEzdzQ5a2FrODl2MXlheSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LN2JXGKWRYUft7eJ9w/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MTg3bGh2dnVwdXc1cmUxcTV1d2ZuMzRkdWEzdzQ5a2FrODl2MXlheSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/suAwqVyxWh9RyGk2iE/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHlwbDJsMXBybjY3eDZhNmp3aHprMTNlejVubHhpNzU5d25icDFxdSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ol96t6QvBO28UgHKdB/giphy.gif'
    ];
    
    const gif = document.createElement('img');
    gif.src = gifs[Math.floor(Math.random() * gifs.length)];
    gif.className = 'celebration-gif';
    document.body.appendChild(gif);
    setTimeout(() => gif.remove(), 2000);
    
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            confetti.style.left = '50%';
            confetti.style.top = '50%';
            confetti.style.setProperty('--tx', (Math.random() - 0.5) * 520 + 'px');
            confetti.style.setProperty('--ty', (Math.random() - 0.5) * 520 + 'px');
            confetti.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 2000);
        }, i * 30);
    }
    
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
    
    const bigText = document.createElement('div');
    bigText.className = 'big-celebration';
    bigText.textContent = ['SHEESH!', 'BATTER UP!', 'LIKE THAT!', '🔥 FIRE 🔥', 'CLIK CLIK!'][Math.floor(Math.random() * 5)];
    document.body.appendChild(bigText);
    setTimeout(() => bigText.remove(), 1200);
}

function spawnTableMasterCelebration() {
    robot.className = 'robot happy';
    feedback.textContent = '';
    feedback.className = 'feedback';
    
    // Create full-screen overlay
    const overlay = document.createElement('div');
    overlay.className = 'master-overlay';
    
    overlay.innerHTML = `
        <div class="master-badge">
            <div class="master-crown">👑</div>
            <div class="master-title">TABLE MASTER</div>
            <div class="master-table">Table de ${challengeTableMode}</div>
            <div class="master-subtitle">완벽해! Parfait!</div>
            <div class="master-stars">⭐ ⭐ ⭐</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Multiple waves of confetti
    for (let wave = 0; wave < 4; wave++) {
        setTimeout(() => {
            const emojis = ['👑', '🏆', '⭐', '🌟', '✨', '💫', '🔥', '💖', '💜', '🎉'];
            for (let i = 0; i < 25; i++) {
                setTimeout(() => {
                    const confetti = document.createElement('div');
                    confetti.className = 'confetti';
                    confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                    confetti.style.left = Math.random() * 100 + '%';
                    confetti.style.top = Math.random() * 100 + '%';
                    confetti.style.setProperty('--tx', (Math.random() - 0.5) * 600 + 'px');
                    confetti.style.setProperty('--ty', (Math.random() - 0.5) * 600 + 'px');
                    confetti.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
                    document.body.appendChild(confetti);
                    setTimeout(() => confetti.remove(), 2500);
                }, i * 20);
            }
        }, wave * 600);
    }
    
    // Play victory sound sequence
    playSound('correct');
    setTimeout(() => playSound('correct'), 400);
    setTimeout(() => playSound('start'), 800);
    
    // Show random gif
    const gifs = [
        'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXp4dmhucmoxcXRnZjZiNHZzbzEzZjFyOXRhbDljYmxoem1iZjR1OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Y97iZVAYoSYfjnYxZY/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MTg3bGh2dnVwdXc1cmUxcTV1d2ZuMzRkdWEzdzQ5a2FrODl2MXlheSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LN2JXGKWRYUft7eJ9w/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MTg3bGh2dnVwdXc1cmUxcTV1d2ZuMzRkdWEzdzQ5a2FrODl2MXlheSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/suAwqVyxWh9RyGk2iE/giphy.gif',
        'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHlwbDJsMXBybjY3eDZhNmp3aHprMTNlejVubHhpNzU5d25icDFxdSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ol96t6QvBO28UgHKdB/giphy.gif'
    ];
    const gif = document.createElement('img');
    gif.src = gifs[Math.floor(Math.random() * gifs.length)];
    gif.className = 'master-gif';
    overlay.querySelector('.master-badge').appendChild(gif);
    
    // Remove overlay on tap
    overlay.addEventListener('click', () => {
        overlay.classList.add('master-fade-out');
        setTimeout(() => overlay.remove(), 500);
    });
    
    // Auto-remove after 6 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.classList.add('master-fade-out');
            setTimeout(() => overlay.remove(), 500);
        }
    }, 6000);
}