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

let score = 0;
let streak = 0;
let currentAnswer = 0;
let maxNumber = 10;
let userInput = '';

// BABYMONSTER song references!
const correctMessages = [
    'SHEESH! 🔥',
    'BATTER UP! ⚾',
    'FOREVER! 💜',
    'STUCK IN THE MIDDLE!',
    'LIKE THAT! 💖',
    'CLIK CLIK CLIK! 📸',
    'DANCE DANCE! 💃',
    'MONSTERS! 👹'
];
const wrongMessages = [
    'PSYCHO... 🌀',
    'DREAM... 💭',
    'ENCORE! 🎤'
];

startBtn.addEventListener('click', () => {
    initAudio();
    playSound('start');
    startGame();
});
submitBtn.addEventListener('click', checkAnswer);
newGameBtn.addEventListener('click', () => {
    settings.classList.remove('hidden');
    game.classList.add('hidden');
    newGameBtn.classList.add('hidden');
    score = 0;
    streak = 0;
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
    const n1 = Math.floor(Math.random() * maxNumber) + 1;
    const n2 = Math.floor(Math.random() * maxNumber) + 1;
    num1El.textContent = n1;
    num2El.textContent = n2;
    currentAnswer = n1 * n2;
    userInput = '';
    updateDisplay();
}

function checkAnswer() {
    const userAnswer = parseInt(userInput);
    
    if (isNaN(userAnswer) || userInput === '') {
        feedback.textContent = 'ENTRE UN NOMBRE !';
        feedback.className = 'feedback';
        return;
    }
    
    if (userAnswer === currentAnswer) {
        playSound('correct');
        score++;
        streak++;
        scoreEl.textContent = score;
        streakEl.textContent = streak;
        feedback.textContent = correctMessages[Math.floor(Math.random() * correctMessages.length)];
        feedback.className = 'feedback correct';
        spawnConfetti();
        
        setTimeout(generateQuestion, 800);
    } else {
        playSound('wrong');
        streak = 0;
        streakEl.textContent = streak;
        feedback.textContent = wrongMessages[Math.floor(Math.random() * wrongMessages.length)] + ` (${currentAnswer})`;
        feedback.className = 'feedback wrong';
        
        setTimeout(generateQuestion, 1500);
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