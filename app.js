/* Modern Tic Tac Toe
   - Medium AI: win if possible -> block -> center -> corner -> random
   - Glass UI, win-line overlay, pop-in animations
   - Turn indicator, scoreboard, draw detection
   - Theme toggle and mode select
   - Sound effects using WebAudio
*/

(() => {
  // Elements
  const boxes = Array.from(document.querySelectorAll('.box'));
  const resetBtn = document.getElementById('reset-btn');
  const newBtn = document.getElementById('new-btn');
  const modal = document.getElementById('result-modal');
  const modalNew = document.getElementById('modal-new');
  const modalReset = document.getElementById('modal-reset');
  const resultText = document.getElementById('result-text');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const turnIndicator = document.getElementById('turn-player');
  const turnWrap = document.getElementById('turn-indicator');
  const winLine = document.getElementById('win-line');
  const boardEl = document.getElementById('board');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const player2NameEl = document.getElementById('player-2-name');
  const confirmModal = document.getElementById('confirm-modal');
  const confirmOk = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
//   const themeToggle = document.getElementById('theme-toggle');
//   const themeLabel = document.getElementById('theme-label');

  // Game state
  let board = Array(9).fill('');
  let turnO = true; // O starts (like original)
  let gameOver = false;
  let scores = { X: 0, O: 0 };
  let mode = 'pvp'; // 'pvp' or 'pve'
  let isAiThinking = false;

  const winPatterns = [
    [0,1,2],[3,4,5],[6,7,8], // rows
    [0,3,6],[1,4,7],[2,5,8], // cols
    [0,4,8],[2,4,6]          // diags
  ];

  // Audio: simple tones using WebAudio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq = 220, time = 0.06, type = 'sine', gain = 0.08) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
    setTimeout(()=> o.stop(), (time + 0.02)*1000);
  }

  function soundPlace(player){
    // X: sharper, O: softer
    if(player === 'X') beep(520, 0.08, 'square', 0.09);
    else beep(320, 0.08, 'sine', 0.08);
  }
  function soundWin(){ beep(720, 0.15, 'sawtooth', 0.14); beep(560, 0.12, 'sine', 0.08); }
  function soundDraw(){ beep(240, 0.12, 'sine', 0.09); beep(180, 0.12, 'sine', 0.09); }

  // Helpers
  const updateUI = () => {
    boxes.forEach((b, idx) => {
      b.innerText = board[idx] || '';
      b.classList.remove('x','o','win','pop-in');
      if(board[idx]) {
        b.classList.add(board[idx] === 'X' ? 'x' : 'o');
        b.disabled = true;
      } else {
        b.disabled = false;
      }
    });
    turnIndicator.innerText = turnO ? 'O' : 'X';
  };

  const resetBoard = (clearScores=false) => {
    board.fill('');
    turnO = true;
    gameOver = false;
    isAiThinking = false;
    winLine.classList.add('hidden');
    updateUI();
    if(clearScores){
      scores = { X:0, O:0};
      scoreXEl.innerText = scores.X;
      scoreOEl.innerText = scores.O;
    }
    hideModal();
  };

  // Show modal
  function showModal(text) {
    resultText.innerText = text;
    modal.classList.remove('hidden');
  }
  function hideModal(){
    modal.classList.add('hidden');
  }

  // Confirmation modal
  function showConfirm() {
    return new Promise((resolve) => {
      confirmModal.classList.remove('hidden');
      
      const handleOk = () => {
        confirmModal.classList.add('hidden');
        confirmOk.removeEventListener('click', handleOk);
        confirmCancel.removeEventListener('click', handleCancel);
        resolve(true);
      };
      
      const handleCancel = () => {
        confirmModal.classList.add('hidden');
        confirmOk.removeEventListener('click', handleOk);
        confirmCancel.removeEventListener('click', handleCancel);
        resolve(false);
      };
      
      confirmOk.addEventListener('click', handleOk);
      confirmCancel.addEventListener('click', handleCancel);
    });
  }

  // Check winner or draw
  function checkWinner() {
    for(const p of winPatterns) {
      const [a,b,c] = p;
      if(board[a] && board[a] === board[b] && board[b] === board[c]) {
        return { winner: board[a], pattern: p };
      }
    }
    if(board.every(cell => cell !== '')) return { winner: null, pattern: null }; // draw
    return null; // game continues
  }

  // Show winning line overlay using positions of boxes
  function showWinningLine(pattern) {
    // coordinates
    const first = boxes[pattern[0]].getBoundingClientRect();
    const last  = boxes[pattern[2]].getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();

    // center positions relative to board
    const x1 = first.left + first.width/2 - boardRect.left;
    const y1 = first.top  + first.height/2 - boardRect.top;
    const x2 = last.left  + last.width/2 - boardRect.left;
    const y2 = last.top   + last.height/2 - boardRect.top;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx*dx + dy*dy);

    const angle = Math.atan2(dy, dx) * (180/Math.PI);

    winLine.style.width = `${length + 18}px`; // a little padding
    winLine.style.left = `${x1 + (x2-x1)/2 - (length/2) - 9}px`;
    winLine.style.top  = `${y1 + (y2-y1)/2 - 4}px`;
    winLine.style.transform = `rotate(${angle}deg)`;
    winLine.classList.remove('hidden');
    // highlight boxes
    pattern.forEach(i => boxes[i].classList.add('win'));
  }

  // Render single move
  function placeMove(index, player, {animate=true, sound=true} = {}) {
    if(gameOver || board[index]) return false;
    board[index] = player;
    if(animate) {
      const el = boxes[index];
      el.classList.add(player === 'X' ? 'x' : 'o');
      // small delay to allow class change then pop-in
      requestAnimationFrame(()=> {
        el.classList.add('pop-in');
      });
    }
    if(sound) soundPlace(player);
    updateUI();
    // check result
    const res = checkWinner();
    if(res) {
      gameOver = true;
      if(res.winner) {
        // winner
        scores[res.winner] += 1;
        scoreXEl.innerText = scores.X;
        scoreOEl.innerText = scores.O;
        // show line & modal
        setTimeout(()=> {
          showWinningLine(res.pattern);
          soundWin();
          showModal(`Congratulations — Winner: ${res.winner}`);
        }, 180);
      } else {
        // draw
        setTimeout(()=> {
          soundDraw();
          showModal(`It's a Draw!`);
        }, 120);
      }
      disableAllBoxes();
    } else {
      // continue game, maybe AI move
      turnO = !turnO;
      updateUI();
    }
    return true;
  }

  function disableAllBoxes() { boxes.forEach(b => b.disabled = true); }
  function enableEmptyBoxes() { boxes.forEach((b,i) => b.disabled = !!board[i]); }

  // Medium AI (win -> block -> center -> corner -> random)
  function aiChooseMove() {
    // returns index
    const me = turnO ? 'O' : 'X';
    const opp = me === 'X' ? 'O' : 'X';

    const avail = board.map((v,i) => v === '' ? i : -1).filter(i=>i>=0);

    // helper to find winning move for a player
    function findWinning(player) {
      for(const p of winPatterns) {
        const values = p.map(i => board[i]);
        const countPlayer = values.filter(v=>v === player).length;
        const countEmpty = values.filter(v=>v === '').length;
        if(countPlayer === 2 && countEmpty === 1) {
          const idx = p[values.indexOf('')];
          return idx;
        }
      }
      return -1;
    }

    // 1. can I win?
    let idx = findWinning(me);
    if(idx !== -1) return idx;

    // 2. block opponent
    idx = findWinning(opp);
    if(idx !== -1) return idx;

    // 3. take center
    if(board[4] === '') return 4;

    // 4. take a corner if available
    const corners = [0,2,6,8].filter(i => board[i] === '');
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];

    // 5. otherwise random available
    if(avail.length) return avail[Math.floor(Math.random()*avail.length)];

    return -1;
  }

  // Event handlers
  boxes.forEach((box, idx) => {
    box.addEventListener('click', async (e) => {
      if(gameOver || board[idx] !== '') return;
      // player move
      const current = turnO ? 'O' : 'X';
      placeMove(idx, current);

      // if playing vs AI and not game over and mode pve and it's now AI's turn
      if(mode === 'pve' && !gameOver) {
        const aiTurnPlayer = turnO ? 'O' : 'X';
        // ensure AI acts only for the AI player (player vs AI: human is X by default? We'll make human always the opposite of AI)
        // For simplicity: In PvE the human is X and AI is O if human clicked as X; but we keep original: O starts.
        // We'll make AI always play when mode is pve AND it's AI's turn (i.e., when mode is pve and turn is AI-controlled).
        // Decide AI is the non-human side: when mode=pve, human is 'X' by default if they ever place X; To avoid confusion:
        // We'll treat AI as follows: When playing pve, AI always plays 'X' if turn is X and human didn't make that move. To keep consistent,
        // simply let AI play when mode==='pve' and after a human move it's AI's turn.
        isAiThinking = true;
        disableAllBoxes();
        // small delay to feel natural
        await new Promise(r => setTimeout(r, 380 + Math.random()*260));
        const move = aiChooseMove();
        if(move >= 0) {
          placeMove(move, turnO ? 'O' : 'X');
        }
        isAiThinking = false;
        enableEmptyBoxes();
      }
    });
  });

  // New round and reset handlers
  newBtn.addEventListener('click', () => resetBoard(false));
  modalNew.addEventListener('click', () => resetBoard(false));
  modalReset.addEventListener('click', () => { resetBoard(true); });

  resetBtn.addEventListener('click', async () => {
    // full reset (scores too) with confirmation
    const confirmed = await showConfirm();
    if(confirmed) {
      resetBoard(true);
    }
  });

  modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // UI highlight
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Set mode
    mode = btn.dataset.mode;

    if(mode === 'pve') {
      player2NameEl.innerText = 'Player O';
    } else {
      player2NameEl.innerText = 'Player O';
    }

    resetBoard(false);
  });
});


// Theme toggle
//   function setTheme(isLight) {
//     document.body.classList.toggle('theme-light', isLight);
//     document.body.classList.toggle('theme-dark', !isLight);
//     themeLabel.innerText = isLight ? 'Light' : 'Dark';
//   }
//   themeToggle.addEventListener('change', (e) => setTheme(e.target.checked));
//   // initial
//   setTheme(false);

  // Click outside modal to close
  modal.addEventListener('click', (ev) => {
    if(ev.target === modal) hideModal();
  });
  
  confirmModal.addEventListener('click', (ev) => {
    if(ev.target === confirmModal) {
      confirmModal.classList.add('hidden');
    }
  });

  // Accessibility: keyboard support for boxes (Enter)
  boxes.forEach((b, i) => {
    b.addEventListener('keydown', (ev) => {
      if(ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        b.click();
      }
    });
  });

  // Observe resize to reposition win-line when visible
  const ro = new ResizeObserver(() => {
    if(!winLine.classList.contains('hidden')) {
      // find current winning pattern by boxes with class 'win'
      const pattern = boxes.map((b, idx) => b.classList.contains('win') ? idx : -1).filter(i=>i>=0);
      if(pattern.length === 3) showWinningLine(pattern);
    }
  });
  ro.observe(boardEl);
  window.addEventListener('scroll', () => {
    if(!winLine.classList.contains('hidden')) {
      // small debounce
      setTimeout(()=> {
        const pattern = boxes.map((b, idx) => b.classList.contains('win') ? idx : -1).filter(i=>i>=0);
        if(pattern.length === 3) showWinningLine(pattern);
      }, 30);
    }
  });

  // Initialize game
  resetBoard(true);

  // Expose for debugging (optional)
  window.__tictactoe = {
    board, placeMove, resetBoard, scores
  };
})();
