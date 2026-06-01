// Web Speech APIの準備
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
}

// 状態管理
let problems = [];
let currentSet = 1;
let correctCount = 0;
const MAX_SETS = 5;
const PROB_COUNT = 4;
let collectedAnswers = [];
let isListening = false;
let startTime = 0;
let hasChecked = false;         // 二重呼び出しガード
let recognitionErrored = false; // エラー状態フラグ

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
const btnKeyboard = document.getElementById('keyboard-btn');
const elKeyboardArea = document.getElementById('keyboard-area');
const elKeyboardLabel = document.getElementById('keyboard-question-label');
const elKeyboardDisplay = document.getElementById('keyboard-display');

// キーボード入力の状態
let keyboardBuffer = '';
let keyboardAnswerIndex = 0;

// 音声認識の初期化に失敗した場合
if (!recognition) {
    btnMic.classList.add('hidden');
    elMicStatus.textContent = "※このブラウザは音声認識に非対応です。タップで入力してください";
}

// もんだいの生成 (4問分)
function generateProblems() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    problems = [];
    collectedAnswers = [];
    hasChecked = false;
    recognitionErrored = false;

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
    btnKeyboard.classList.remove('hidden');
    btnNext.classList.add('hidden');
    elKeyboardArea.classList.add('hidden');
    keyboardBuffer = '';
    keyboardAnswerIndex = 0;
    elMicStatus.textContent = "";
    updateMicButtonText();

    startTime = Date.now();
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
        btnNext.classList.add('hidden');
        btnRestart.classList.remove('hidden');
        elResultMark.textContent = `おわり！ ${MAX_SETS * PROB_COUNT}もんちゅう ${correctCount}もん せいかい！`;
        elResultMark.style.fontSize = "20px";
        elResultMark.style.color = "#ff9800";

        if (correctCount === MAX_SETS * PROB_COUNT) {
            speakMessage("ぜんぶのもんだいが おわったよ！さいごまで ぜんもんせいかい！すばらしい！");
        } else {
            speakMessage(`ぜんぶのもんだいが おわったよ！ ${correctCount}もん せいかいしました！`);
        }
    }
});

btnRestart.addEventListener('click', resetGame);

btnKeyboard.addEventListener('click', () => {
    btnMic.classList.add('hidden');
    btnKeyboard.classList.add('hidden');
    elKeyboardArea.classList.remove('hidden');
    collectedAnswers = [];
    keyboardBuffer = '';
    keyboardAnswerIndex = 0;
    hasChecked = false;
    updateKeyboardDisplay();
});

function updateKeyboardDisplay() {
    const labels = ['①', '②', '③', '④'];
    elKeyboardLabel.textContent = labels[keyboardAnswerIndex] + 'のこたえは？';
    elKeyboardDisplay.textContent = keyboardBuffer || '--';
}

document.querySelectorAll('.num-key').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if (val === 'del') {
            keyboardBuffer = keyboardBuffer.slice(0, -1);
        } else if (val === 'ok') {
            if (keyboardBuffer.length === 0) return;
            const num = parseInt(keyboardBuffer, 10);
            collectedAnswers.push(num);

            // 答えた番号のボックスに入力値を表示
            const box = document.getElementById(`answer-${keyboardAnswerIndex}`);
            box.textContent = num;
            box.classList.add('filled');

            keyboardAnswerIndex++;
            keyboardBuffer = '';

            if (keyboardAnswerIndex >= PROB_COUNT) {
                elKeyboardArea.classList.add('hidden');
                if (!hasChecked) {
                    hasChecked = true;
                    checkAnswers();
                }
            } else {
                updateKeyboardDisplay();
            }
            return;
        } else {
            if (keyboardBuffer.length < 3) {
                keyboardBuffer += val;
            }
        }
        updateKeyboardDisplay();
    });
});

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

    if (collectedAnswers.length < PROB_COUNT) {
        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }
});

function updateMicButtonText() {
    if (isListening) {
        btnMic.classList.add('listening');
        btnMic.textContent = `👂 きいています... (${collectedAnswers.length}/${PROB_COUNT})`;
        if (!recognitionErrored) {
            elMicStatus.textContent = "こたえを 言ってね";
        }
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
        recognitionErrored = false;
        updateMicButtonText();
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (interimTranscript) {
            elRecognizedText.textContent = `(ききとりちゅう...) ${interimTranscript}`;
            elRecognizedText.style.color = "#999";
        }

        if (finalTranscript) {
            console.log("確定認識結果:", finalTranscript);
            const newNumbers = parseSpeechToNumbers(finalTranscript);
            elRecognizedText.style.color = "#555";

            if (newNumbers.length > 0) {
                collectedAnswers.push(...newNumbers);

                if (collectedAnswers.length > PROB_COUNT) {
                    collectedAnswers = collectedAnswers.slice(0, PROB_COUNT);
                }

                elRecognizedText.textContent = `${collectedAnswers.join(', ')}`;
                updateMicButtonText();

                // 二重呼び出しをガード
                if (collectedAnswers.length >= PROB_COUNT && !hasChecked) {
                    hasChecked = true;
                    checkAnswers();
                } else if (collectedAnswers.length < PROB_COUNT) {
                    elMicStatus.textContent = "つぎのこたえを言ってね！";
                }
            } else {
                elRecognizedText.textContent = `❓ (${finalTranscript})`;
                elMicStatus.textContent = "もう一度言ってね";
                recognitionErrored = true;
            }
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        if (event.error !== 'no-speech') {
            recognitionErrored = true;
            elMicStatus.textContent = "マイクがうまく使えませんでした";
        }
    };

    recognition.onend = () => {
        isListening = false;
        updateMicButtonText();

        // エラー時や認識できなかった場合は自動再開しない
        if (collectedAnswers.length > 0 && collectedAnswers.length < PROB_COUNT && !recognitionErrored) {
            elMicStatus.textContent = "つづきのこたえを言ってね！";
            try {
                recognition.start();
            } catch(e){}
        }
    };
}

// 答え合わせ
function checkAnswers() {
    // 進行中の音声認識を停止
    if (isListening) {
        try { recognition.stop(); } catch(e) {}
    }

    btnMic.classList.add('hidden');
    btnKeyboard.classList.add('hidden');
    elMicStatus.textContent = "こたえあわせ！";

    let allCorrect = true;

    for (let i = 0; i < PROB_COUNT; i++) {
        let userAnswer = collectedAnswers[i];
        let correctAns = problems[i].answer;

        let box = document.getElementById(`answer-${i}`);
        let resMark = document.getElementById(`result-${i}`);

        box.classList.add('filled');

        if (userAnswer === correctAns) {
            box.textContent = userAnswer;
            resMark.textContent = "◯";
            resMark.classList.add('correct');
            correctCount++;
        } else {
            // 言った答え（取り消し線）と正解の両方を表示
            box.innerHTML = `<span style="text-decoration:line-through;color:#aaa;font-size:0.65em">${userAnswer}</span><br>${correctAns}`;
            box.style.color = "#0000ff";
            resMark.textContent = "✘";
            resMark.classList.add('incorrect');
            allCorrect = false;
        }
    }

    elCorrectCount.textContent = correctCount;

    if (allCorrect) {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        elResultMark.textContent = `パーフェクト！🎉 ${timeTaken}びょうで できたよ！`;
        elResultMark.className = "result-mark correct";
        speakMessage(`やったね！ぜんもんせいかい！${timeTaken}びょうでできたよ！すごい！`);
    } else {
        elResultMark.textContent = "ざんねん！";
        elResultMark.className = "result-mark incorrect";
    }

    btnNext.classList.remove('hidden');
}

// 読み上げ用の関数
function speakMessage(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const uttr = new SpeechSynthesisUtterance(text);
        uttr.lang = 'ja-JP';
        uttr.rate = 1.1;
        uttr.pitch = 1.2;
        window.speechSynthesis.speak(uttr);
    }
}

// 音声認識結果から日本語数字・漢数字・アラビア数字を整数に変換する関数
function parseSpeechToNumbers(text) {
    // 1. 全角を半角に
    let s = text.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

    // 2. 数字・漢数字・特定ひらがな以外をスペースに置換
    s = s.replace(/[^0-9〇一二三四五六七八九十百ぜろれいまるいちにさんしよんごろくななしちはちきゅうくじゅうひゃく]/g, ' ');

    const digitMap = {
        '〇':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9,
        'ぜろ':0, 'れい':0, 'まる':0,
        'いち':1, 'に':2, 'さん':3, 'し':4, 'よん':4, 'ご':5, 'ろく':6, 'なな':7, 'しち':7, 'はち':8, 'きゅう':9, 'く':9,
        '十':10, 'じゅう':10, '百':100, 'ひゃく':100
    };

    let parts = s.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return [];

    let nums = [];

    for (let part of parts) {
        if (/^\d+$/.test(part)) {
            nums.push(parseInt(part, 10));
            continue;
        }

        let currentTotal = 0;
        let currentNum = 0;
        let hasNumber = false;

        for (let i = 0; i < part.length; i++) {
            let matchedValue = null;
            let matchedLength = 0;

            const keys = Object.keys(digitMap).sort((a, b) => b.length - a.length);
            for (let key of keys) {
                if (part.substring(i, i + key.length) === key) {
                    matchedValue = digitMap[key];
                    matchedLength = key.length;
                    break;
                }
            }

            if (matchedValue !== null) {
                hasNumber = true;
                if (matchedValue === 10 || matchedValue === 100) {
                    if (currentNum === 0) currentNum = 1;
                    currentTotal += currentNum * matchedValue;
                    currentNum = 0;
                } else {
                    if (currentNum !== 0) {
                        currentNum = currentNum * 10 + matchedValue;
                    } else {
                        currentNum = matchedValue;
                    }
                }
                i += matchedLength - 1;
            } else if (/\d/.test(part[i])) {
                hasNumber = true;
                let numVal = parseInt(part[i], 10);
                if (currentNum !== 0) {
                    currentNum = currentNum * 10 + numVal;
                } else {
                    currentNum = numVal;
                }
            }
        }
        if (hasNumber) {
            currentTotal += currentNum;
            nums.push(currentTotal);
        }
    }

    // 「百」と「二十」が別トークンで認識された場合のみ結合 (例: 100, 20 → 120)
    // ※「30, 7」のような別々の答えを誤って37に結合しないよう、他の結合ルールは除去
    let combined = [];
    let current = null;

    for (let num of nums) {
        if (current === null) {
            current = num;
        } else if (current === 100 && num < 100) {
            let temp = current + num;
            if (temp <= 200) {
                current = temp;
            } else {
                combined.push(current);
                current = num;
            }
        } else {
            combined.push(current);
            current = num;
        }
    }
    if (current !== null) {
        combined.push(current);
    }

    return combined;
}

// 初期化実行
generateProblems();
