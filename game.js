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
const numButtons = document.querySelectorAll('.num-btn');
const robot = document.getElementById('robot');
const timerFill = document.getElementById('timerFill');
const challengesPanel = document.getElementById('challengesPanel');
const challengesList = document.getElementById('challengesList');

let score = 0;
let streak = 0;
let currentAnswer = 0;
let maxNumber = 10;
let userInput = '';
let currentNum1 = 0;
let currentNum2 = 0;
let timer = null;
let timeLeft = 11;
const TIMER_DURATION = 11;
let challenges = []; // Array of {n1, n2, answer}

// BABYMONSTER song references + Korean encouragement!
const correctMessages = [
    'SHEESH! 🔥',
    'BATTER UP! ⚾',
    'FOREVER! 💜',
    '대박! (Daebak!) 🌟',      // Amazing!
    '잘했어! (Jalhesseo!) 💖',  // Well done!
    '최고! (Chego!) 👑',       // The best!
    '화이팅! (Hwaiting!) 💪',  // Fighting!
    '완벽해! (Wanbyeokae!) ✨', // Perfect!
    'LIKE THAT! 💖',
    'CLIK CLIK CLIK! 📸',
    '멋져! (Meotjyeo!) 🔥',    // Awesome!
    '천재! (Cheonjae!) 🧠'     // Genius!
];
const wrongMessages = [
    '괜찮아~ (Gwaenchana~) 💭',  // It's okay~
    '다시! (Dasi!) 🎤',          // Again!
    '힘내! (Himnae!) 💪',        // Cheer up!
    '아깝다~ (Akkapda~) 😅'      // So close~
];

startBtn.addEventListener('click', () => {
    initAudio();
    playSound('start');
    startGame();
});
submitBtn.addEventListener('click', checkAnswer);
newGameBtn.addEventListener('click', () => {
    stopTimer();
    settings.classList.remove('hidden');
    game.classList.add('hidden');
    newGameBtn.classList.add('hidden');
    challengesPanel.classList.remove('visible');
    score = 0;
    streak = 0;
    challenges = [];
});

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
    userInput = '';
    challenges = [];
    updateChallengesPanel();
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    settings.classList.add('hidden');
    game.classList.remove('hidden');
    feedback.textContent = '';
    feedback.className = 'feedback';
    updateDisplay();
    generateQuestion();
}

function generateQuestion() {
    stopTimer();
    
    // 30% chance to pick from challenges if there are any
    if (challenges.length > 0 && Math.random() < 0.3) {
        const challengeIndex = Math.floor(Math.random() * challenges.length);
        const challenge = challenges[challengeIndex];
        currentNum1 = challenge.n1;
        currentNum2 = challenge.n2;
        currentAnswer = challenge.answer;
    } else {
        currentNum1 = Math.floor(Math.random() * maxNumber) + 1;
        currentNum2 = Math.floor(Math.random() * maxNumber) + 1;
        currentAnswer = currentNum1 * currentNum2;
    }
    
    num1El.textContent = currentNum1;
    num2El.textContent = currentNum2;
    userInput = '';
    updateDisplay();
    startTimer();
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
        scoreEl.textContent = score;
        streakEl.textContent = streak;
        feedback.textContent = correctMessages[Math.floor(Math.random() * correctMessages.length)];
        feedback.className = 'feedback correct';
        
        // Check if this was a challenge and remove it
        removeChallengeIfExists(currentNum1, currentNum2);
        
        spawnConfetti();
        
        setTimeout(generateQuestion, 800);
    } else {
        handleWrongAnswer();
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
    
    // Add to challenges if not already there
    addToChallenge(currentNum1, currentNum2, currentAnswer);
    
    setTimeout(generateQuestion, 1500);
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
        return;
    }
    
    challengesPanel.classList.add('visible');
    challengesList.innerHTML = challenges.map(c => 
        `<div class="challenge-item">${c.n1}×${c.n2}</div>`
    ).join('');
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
    
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            confetti.style.left = '50%';
            confetti.style.top = '50%';
            confetti.style.setProperty('--tx', (Math.random() - 0.5) * 400 + 'px');
            confetti.style.setProperty('--ty', (Math.random() - 0.5) * 400 + 'px');
            confetti.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 1500);
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