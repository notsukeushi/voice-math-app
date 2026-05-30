// Web Speech APIの準備
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true; // 中間結果を即時表示
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // 音声認識が早く終了するようにfalse
}

// 状態管理
let problems = []; // {num1, num2, operator, answer} * 4
let currentSet = 1;
let correctCount = 0;
const MAX_SETS = 5; // 4問 * 5セット = 20問
const PROB_COUNT = 4;
let collectedAnswers = [];
let isListening = false;
let startTime = 0;

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
    
    // 時間計測スタート
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
        // 終了
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
        if (elMicStatus.textContent !== "もう一度言ってね") {
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

        // 中間結果の即時表示
        if (interimTranscript) {
            elRecognizedText.textContent = `(ききとりちゅう...) ${interimTranscript}`;
            elRecognizedText.style.color = "#999";
        }

        // 確定結果の処理
        if (finalTranscript) {
            console.log("確定認識結果:", finalTranscript);
            const newNumbers = parseSpeechToNumbers(finalTranscript);
            elRecognizedText.style.color = "#555";
            
            if (newNumbers.length > 0) {
                collectedAnswers.push(...newNumbers);
                
                // 4個以上になったら切り詰める
                if (collectedAnswers.length > PROB_COUNT) {
                    collectedAnswers = collectedAnswers.slice(0, PROB_COUNT);
                }
                
                elRecognizedText.textContent = `${collectedAnswers.join(', ')}`;
                updateMicButtonText();
                
                if (collectedAnswers.length >= PROB_COUNT) {
                    checkAnswers();
                } else {
                    elMicStatus.textContent = "つぎのこたえを言ってね！";
                }
            } else {
                // 認識できなかった（数字が含まれていなかった）
                elRecognizedText.textContent = `❓ (${finalTranscript})`;
                elMicStatus.textContent = "もう一度言ってね";
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
            if (elMicStatus.textContent !== "もう一度言ってね") {
                elMicStatus.textContent = "つづきのこたえを言ってね！";
            }
            try {
                recognition.start();
            } catch(e){}
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
        }
    }
    
    elCorrectCount.textContent = correctCount;
    
    if (allCorrect) {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        elResultMark.textContent = `パーフェクト！🎉 ${timeTaken}びょうで できたよ！`;
        elResultMark.className = "result-mark correct";
        
        // 音声で祝福
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
    
    // 2. 答えの範囲が0〜200程度であることを利用して、数字以外の余計な文字を除去する
    // 数字、漢字、特定のひらがな以外をスペースに置換
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
    
    // 「30 7」や「三 七」などを 37 と解釈できるように、隣り合う数字を可能な限り結合する
    let combined = [];
    let current = null;
    
    for (let num of nums) {
        if (current === null) {
            current = num;
        } else {
            // currentとnumを結合できるかチェック (0〜200程度の範囲)
            if (current < 10 && num < 10) {
                // 例: 3 と 7 -> 37
                let temp = current * 10 + num;
                if (temp <= 200) {
                    current = temp;
                } else {
                    combined.push(current);
                    current = num;
                }
            } else if (current % 10 === 0 && num < 10) {
                // 例: 30 と 7 -> 37
                let temp = current + num;
                if (temp <= 200) {
                    current = temp;
                } else {
                    combined.push(current);
                    current = num;
                }
            } else if (current === 100 && num < 100) {
                // 例: 100 と 20 -> 120
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
    }
    if (current !== null) {
        combined.push(current);
    }
    
    return combined;
}

// 初期化実行
generateProblems();