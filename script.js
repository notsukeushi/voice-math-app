// Web Speech APIの準備
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true; // 連続で聞き取る
}

// 状態管理
let problems = []; // {num1, num2, operator, answer} * 4
let currentSet = 1;
let correctCount = 0;
const MAX_SETS = 5; // 4問 * 5セット = 20問
const PROB_COUNT = 4;
let collectedAnswers = [];
let isListening = false;

// DOM要素の取得
const elQuestionCount = document.getElementById('question-count');
const elCorrectCount = document.getElementById('correct-count');
const elRecognizedText = document.querySelector('#recognized-text span');
const elResultMark = document.getElementById('result-mark');
const btnMic = document.getElementById('mic-btn');
const btnNext = document.getElementById('next-btn');
const btnRestart = document.getElementById('restart-btn');
const radiosMode = document.querySelectorAll('input[name="mode"]');
const elMicStatus = document.getElementById('mic-status');

// 音声認識の初期化に失敗した場合
if (!recognition) {
    alert("お使いのブラウザは音声認識に対応していません。ChromeやEdgeを使用してください。");
    btnMic.disabled = true;
    elMicStatus.textContent = "※このブラウザは音声認識に非対応です";
}

// もんだいの生成 (4問分)
function generateProblems() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    problems = [];
    collectedAnswers = [];

    for (let i = 0; i < PROB_COUNT; i++) {
        let num1 = Math.floor(Math.random() * 90) + 10;
        let num2 = Math.floor(Math.random() * 90) + 10;
        let answer = 0;
        let op = '+';

        if (mode === 'add') {
            answer = num1 + num2;
        } else {
            if (num1 < num2) {
                let temp = num1; num1 = num2; num2 = temp;
            }
            answer = num1 - num2;
            op = '-';
        }

        problems.push({ num1, num2, operator: op, answer });

        // 画面にセット
        document.getElementById(`num1-${i}`).textContent = num1;
        document.getElementById(`num2-${i}`).textContent = num2;
        document.getElementById(`operator-${i}`).textContent = op;
        document.getElementById(`answer-${i}`).textContent = '?';
        document.getElementById(`answer-${i}`).classList.remove('filled');
        document.getElementById(`answer-${i}`).style.color = "";
        
        let resEl = document.getElementById(`result-${i}`);
        resEl.textContent = '';
        resEl.className = 'prob-result';
    }

    elRecognizedText.textContent = '-';
    elResultMark.textContent = '';
    
    btnMic.classList.remove('hidden');
    btnNext.classList.add('hidden');
    elMicStatus.textContent = "";
    updateMicButtonText();
}

// 初期化とイベントリスナー
radiosMode.forEach(radio => {
    radio.addEventListener('change', () => {
        resetGame();
    });
});

btnNext.addEventListener('click', () => {
    if (currentSet < MAX_SETS) {
        currentSet++;
        elQuestionCount.textContent = currentSet;
        generateProblems();
    } else {
        // 終了
        btnNext.classList.add('hidden');
        btnRestart.classList.remove('hidden');
        elResultMark.textContent = `おわり！ ${MAX_SETS * PROB_COUNT}もんちゅう ${correctCount}もん せいかい！`;
        elResultMark.style.fontSize = "20px";
        elResultMark.style.color = "#ff9800";
    }
});

btnRestart.addEventListener('click', resetGame);

function resetGame() {
    currentSet = 1;
    correctCount = 0;
    elQuestionCount.textContent = currentSet;
    elCorrectCount.textContent = correctCount;
    btnRestart.classList.add('hidden');
    elResultMark.style.fontSize = "30px";
    generateProblems();
}

// マイクボタンの処理
btnMic.addEventListener('click', () => {
    if (isListening) {
        recognition.stop();
        return;
    }
    
    // まだ4問答えていない場合は開始
    if (collectedAnswers.length < PROB_COUNT) {
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            // すでに開始している場合のエラーなどは無視
        }
    }
});

function updateMicButtonText() {
    if (isListening) {
        btnMic.classList.add('listening');
        btnMic.textContent = `👂 きいています... (${collectedAnswers.length}/${PROB_COUNT})`;
        elMicStatus.textContent = "こたえを 順番に 言ってね (例: 10、20、30、40)";
    } else {
        btnMic.classList.remove('listening');
        btnMic.textContent = collectedAnswers.length > 0 ? `🎤 つづきを言う (${collectedAnswers.length}/${PROB_COUNT})` : "🎤 4つのこたえを言う";
        if (collectedAnswers.length === 0) {
            elMicStatus.textContent = "";
        }
    }
}

// 音声認識イベント
if (recognition) {
    recognition.onstart = () => {
        isListening = true;
        updateMicButtonText();
    };

    recognition.onresult = (event) => {
        // 連続認識の最新の結果を取得
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log("認識結果:", transcript);
        
        const newNumbers = parseSpeechToNumbers(transcript);
        
        if (newNumbers.length > 0) {
            collectedAnswers.push(...newNumbers);
            
            // 4個以上になったら切り詰める
            if (collectedAnswers.length > PROB_COUNT) {
                collectedAnswers = collectedAnswers.slice(0, PROB_COUNT);
            }
            
            elRecognizedText.textContent = `${collectedAnswers.join(', ')}`;
            updateMicButtonText();
            
            if (collectedAnswers.length >= PROB_COUNT) {
                recognition.stop();
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        if (event.error !== 'no-speech') {
            elMicStatus.textContent = "マイクがうまく使えませんでした";
        }
    };

    recognition.onend = () => {
        isListening = false;
        updateMicButtonText();
        
        // 途中で途切れてしまったが、まだ4問揃っていない場合は自動で再開を試みる (使いやすさのため)
        if (collectedAnswers.length > 0 && collectedAnswers.length < PROB_COUNT) {
            elMicStatus.textContent = "つづきのこたえを言ってね！";
            try {
                recognition.start();
            } catch(e){}
        } else if (collectedAnswers.length >= PROB_COUNT) {
            checkAnswers();
        }
    };
}

// 答え合わせ
function checkAnswers() {
    btnMic.classList.add('hidden');
    elMicStatus.textContent = "こたえあわせ！";
    
    let allCorrect = true;
    
    for (let i = 0; i < PROB_COUNT; i++) {
        let userAnswer = collectedAnswers[i];
        let correctAns = problems[i].answer;
        
        let box = document.getElementById(`answer-${i}`);
        let resMark = document.getElementById(`result-${i}`);
        
        box.textContent = userAnswer;
        box.classList.add('filled');
        
        if (userAnswer === correctAns) {
            resMark.textContent = "◯";
            resMark.classList.add('correct');
            correctCount++;
        } else {
            resMark.textContent = "✘";
            resMark.classList.add('incorrect');
            allCorrect = false;
            // ほんとうの答え
            box.textContent = correctAns;
            box.style.color = "#0000ff";
            
            // ユーザーの答えを下に見せるか、上書きするか。今回は上書きして青色にする
        }
    }
    
    elCorrectCount.textContent = correctCount;
    
    if (allCorrect) {
        elResultMark.textContent = "パーフェクト！🎉";
        elResultMark.className = "result-mark correct";
    } else {
        elResultMark.textContent = "ざんねん！";
        elResultMark.className = "result-mark incorrect";
    }
    
    btnNext.classList.remove('hidden');
}

// 日本語の音声を数字の配列に変換する関数
function parseSpeechToNumbers(text) {
    // 1. 全角数字を半角に
    let s = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // 2. 余計な言葉を削除
    s = s.replace(/です|だよ|だ|と|や|の|つぎ|は/g, ' ');
    // 3. 句読点や記号をスペースに
    s = s.replace(/[、。・,，\s]+/g, ' ');
    
    let parts = s.split(' ').filter(p => p.length > 0);
    let nums = [];
    
    for(let part of parts) {
        let n = parseSpeechToSingleNumber(part);
        if(!isNaN(n)) {
            nums.push(n);
        } else {
            // パートの中に数字が連続している場合 (例: "7280" => 分割が難しいが、アラビア数字だけなら取り出す)
            const digits = part.match(/\d+/g);
            if (digits) {
                nums.push(...digits.map(d => parseInt(d, 10)));
            }
        }
    }
    return nums;
}

// 単一の文字列を数字にする(前のバージョンと同じ)
function parseSpeechToSingleNumber(s) {
    const match = s.match(/^\d+$/);
    if (match) return parseInt(match[0], 10);

    const digits = {
        '〇':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9,
        'ぜろ':0, 'れい':0, 'まる':0,
        'いち':1, 'に':2, 'さん':3, 'し':4, 'よん':4, 'ご':5, 'ろく':6, 'なな':7, 'しち':7, 'はち':8, 'きゅう':9, 'く':9
    };
    
    let total = 0;
    let originalS = s;

    if (s.includes('百') || s.includes('ひゃく')) {
        total += 100;
        s = s.replace(/百|ひゃく/, '');
    }

    let tenIndex = Math.max(s.indexOf('十'), s.indexOf('じゅう'));
    if (tenIndex !== -1) {
        let tenWord = s.includes('十') ? '十' : 'じゅう';
        let p = s.split(tenWord);
        let prefix = p[0];
        
        if (prefix === '') {
            total += 10;
        } else {
            let n = digits[prefix] || parseInt(prefix);
            if (!isNaN(n)) total += n * 10;
        }
        s = p[1]; 
    }

    if (s && s.length > 0) {
        let n = digits[s] || parseInt(s);
        if (!isNaN(n)) total += n;
    }

    if (total === 0 && !['〇','ぜろ','れい','まる','0'].includes(originalS)) {
        return NaN;
    }

    return total;
}

// 初期化実行
generateProblems();
