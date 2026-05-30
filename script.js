// Web Speech APIの準備
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// 状態管理
let currentNum1 = 0;
let currentNum2 = 0;
let currentAnswer = 0;
let questionCount = 1;
let correctCount = 0;
const MAX_QUESTIONS = 10;
let isAnswered = false;

// DOM要素の取得
const elNum1 = document.getElementById('num1');
const elNum2 = document.getElementById('num2');
const elOperator = document.getElementById('operator');
const elAnswerBox = document.getElementById('answer');
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

// もんだいの生成
function generateProblem() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // 2桁 (10〜99)
    currentNum1 = Math.floor(Math.random() * 90) + 10;
    currentNum2 = Math.floor(Math.random() * 90) + 10;

    if (mode === 'add') {
        currentAnswer = currentNum1 + currentNum2;
        elOperator.textContent = '+';
    } else {
        // 引き算の場合、答えがマイナスにならないように入れ替える
        if (currentNum1 < currentNum2) {
            let temp = currentNum1;
            currentNum1 = currentNum2;
            currentNum2 = temp;
        }
        currentAnswer = currentNum1 - currentNum2;
        elOperator.textContent = '-';
    }

    elNum1.textContent = currentNum1;
    elNum2.textContent = currentNum2;
    elAnswerBox.textContent = '?';
    elAnswerBox.classList.remove('filled');
    elRecognizedText.textContent = '-';
    elResultMark.textContent = '';
    elResultMark.className = 'result-mark';
    
    isAnswered = false;
    btnMic.classList.remove('hidden');
    btnNext.classList.add('hidden');
    elMicStatus.textContent = "";
}

// 初期化とイベントリスナー
radiosMode.forEach(radio => {
    radio.addEventListener('change', () => {
        resetGame();
    });
});

btnNext.addEventListener('click', () => {
    if (questionCount < MAX_QUESTIONS) {
        questionCount++;
        elQuestionCount.textContent = questionCount;
        generateProblem();
    } else {
        // 終了
        btnNext.classList.add('hidden');
        btnRestart.classList.remove('hidden');
        elResultMark.textContent = `おわり！ ${MAX_QUESTIONS}もんちゅう ${correctCount}もん せいかい！`;
        elResultMark.style.fontSize = "30px";
        elResultMark.style.color = "#ff9800";
    }
});

btnRestart.addEventListener('click', resetGame);

function resetGame() {
    questionCount = 1;
    correctCount = 0;
    elQuestionCount.textContent = questionCount;
    elCorrectCount.textContent = correctCount;
    btnRestart.classList.add('hidden');
    elResultMark.style.fontSize = "80px";
    generateProblem();
}

// マイクボタンの処理
btnMic.addEventListener('click', () => {
    if (isAnswered) return;
    
    try {
        recognition.start();
        btnMic.classList.add('listening');
        btnMic.textContent = "👂 きいています...";
        elMicStatus.textContent = "こたえを声にだして言ってね";
    } catch (e) {
        console.error(e);
        elMicStatus.textContent = "マイクのエラーです";
    }
});

// 音声認識イベント
if (recognition) {
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("認識結果:", transcript);
        
        const parsedNumber = parseSpeechToNumber(transcript);
        
        // 画面に表示
        elRecognizedText.textContent = `${transcript} → [${parsedNumber}]`;
        
        if (isNaN(parsedNumber)) {
            elResultMark.textContent = "？";
            elResultMark.className = "result-mark";
            elMicStatus.textContent = "もういちど言ってね";
            return;
        }
        
        checkAnswer(parsedNumber);
    };

    recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        btnMic.classList.remove('listening');
        btnMic.textContent = "🎤 こたえる (マイク)";
        elMicStatus.textContent = "マイクがうまく使えませんでした";
    };

    recognition.onend = () => {
        btnMic.classList.remove('listening');
        btnMic.textContent = "🎤 こたえる (マイク)";
        if (!isAnswered && elMicStatus.textContent === "こたえを声にだして言ってね") {
             elMicStatus.textContent = "";
        }
    };
}

// 答え合わせ
function checkAnswer(userAnswer) {
    isAnswered = true;
    btnMic.classList.add('hidden');
    elAnswerBox.textContent = userAnswer;
    elAnswerBox.classList.add('filled');
    
    if (userAnswer === currentAnswer) {
        elResultMark.textContent = "◯ せいかい！";
        elResultMark.className = "result-mark correct";
        correctCount++;
        elCorrectCount.textContent = correctCount;
    } else {
        elResultMark.textContent = "✘ もういちど";
        elResultMark.className = "result-mark incorrect";
        // 本当の答えを見せる
        elAnswerBox.textContent = currentAnswer;
        elAnswerBox.style.color = "#0000ff";
    }
    
    elMicStatus.textContent = "";
    btnNext.classList.remove('hidden');
}

// 日本語の音声を数字に変換する関数
function parseSpeechToNumber(text) {
    // 余計な言葉を削除 (です、だよ など)
    let s = text.replace(/です|だよ|だ/g, '');
    
    // 全角数字を半角に
    s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // 空白や句読点除去
    s = s.replace(/[\s、。]/g, '');
    
    // アラビア数字が含まれていたらそれを抽出 (例: "72ですね" -> 72)
    const match = s.match(/\d+/);
    if (match && !s.includes('百') && !s.includes('十')) {
        return parseInt(match[0], 10);
    }

    const digits = {
        '〇':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9,
        'ぜろ':0, 'れい':0, 'まる':0,
        'いち':1, 'に':2, 'さん':3, 'し':4, 'よん':4, 'ご':5, 'ろく':6, 'なな':7, 'しち':7, 'はち':8, 'きゅう':9, 'く':9
    };
    
    let total = 0;
    let originalS = s;

    // 100の位
    if (s.includes('百') || s.includes('ひゃく')) {
        total += 100;
        s = s.replace(/百|ひゃく/, '');
    }

    // 10の位
    let tenIndex = Math.max(s.indexOf('十'), s.indexOf('じゅう'));
    if (tenIndex !== -1) {
        let tenWord = s.includes('十') ? '十' : 'じゅう';
        let parts = s.split(tenWord);
        let prefix = parts[0];
        
        if (prefix === '') {
            total += 10;
        } else {
            let n = digits[prefix] || parseInt(prefix);
            if (!isNaN(n)) total += n * 10;
        }
        s = parts[1]; // 十の後の部分
    }

    // 1の位
    if (s && s.length > 0) {
        let n = digits[s] || parseInt(s);
        if (!isNaN(n)) total += n;
    }

    // パース失敗時（totalが0で、元の文字が0を意味しない場合）
    if (total === 0 && !['〇','ぜろ','れい','まる','0'].includes(originalS)) {
        return NaN;
    }

    return total;
}

// 初期化実行
generateProblem();
