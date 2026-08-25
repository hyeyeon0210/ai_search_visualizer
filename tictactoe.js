/* ==========================================================================
   tictactoe.js - 틱택토 게임 트리 탐색 시뮬레이터

   교육적 단순화: 이 시뮬레이션은 틱택토의 상태 공간(게임 트리)에서
   "X가 승리하는 가장 먼저 발견되는 경로"를 찾는 과정을 보여줍니다.
   상대(O)가 항상 최선의 수를 둔다고 가정하는 미니맥스(Minimax)와는
   다른, 순수한 상태공간 탐색의 예시입니다. (미니맥스는 적대적 탐색이라는
   별도 주제입니다.)
   ========================================================================== */

(function () {
  "use strict";

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
    [0, 4, 8], [2, 4, 6],            // 대각선
  ];

  let currentInitial = Array(9).fill(null);

  function countMarks(state) {
    let x = 0, o = 0;
    state.forEach((v) => {
      if (v === "X") x++;
      else if (v === "O") o++;
    });
    return { x, o };
  }

  function nextPlayer(state) {
    const { x, o } = countMarks(state);
    return x <= o ? "X" : "O";
  }

  function stateKey(state) {
    return state.map((v) => v || ".").join("");
  }

  function hasWin(state, player) {
    return LINES.some((line) => line.every((i) => state[i] === player));
  }

  function goalTest(state) {
    return hasWin(state, "X");
  }

  function successors(state) {
    if (hasWin(state, "X") || hasWin(state, "O")) return []; // 이미 종료된 상태
    const player = nextPlayer(state);
    const moves = [];
    state.forEach((v, i) => {
      if (v === null) {
        const next = state.slice();
        next[i] = player;
        const row = Math.floor(i / 3) + 1, col = (i % 3) + 1;
        moves.push({ state: next, action: `${player} → (${row}행, ${col}열)`, stepCost: 1 });
      }
    });
    return moves;
  }

  // h(n): X가 이길 수 있는 가장 가까운 줄까지 남은 칸 수 (O가 이미 막은 줄은 제외)
  function heuristic(state) {
    if (hasWin(state, "X")) return 0;
    let best = 9;
    LINES.forEach((line) => {
      if (line.some((i) => state[i] === "O")) return; // O가 막은 줄
      const xCount = line.filter((i) => state[i] === "X").length;
      best = Math.min(best, 3 - xCount);
    });
    return best;
  }

  function makeProblem() {
    return {
      initialState: currentInitial.slice(),
      goalTest,
      successors,
      heuristic,
      stateKey,
    };
  }

  // ---------- 프리셋 ----------

  const PRESETS = {
    short: [
      "X", "X", null,
      "O", "O", null,
      null, null, null,
    ],
    medium: [
      "X", null, null,
      null, "O", null,
      null, null, null,
    ],
    empty: Array(9).fill(null),
  };

  // ---------- 렌더링 ----------

  function renderBoard(container, state, editable, onCellClick) {
    container.innerHTML = "";
    state.forEach((v, i) => {
      const cell = document.createElement("div");
      cell.className = "ttt-cell" + (v === "X" ? " x" : v === "O" ? " o" : "") + (editable ? " editable" : "");
      cell.textContent = v || "";
      if (editable) {
        cell.addEventListener("click", () => onCellClick(i));
      }
      container.appendChild(cell);
    });
  }

  function formatNode(node) {
    return node.state.map((v) => v || ".").join("");
  }

  function renderMiniBoard(state) {
    const div = document.createElement("div");
    div.className = "path-mini-board";
    state.forEach((v) => {
      const cell = document.createElement("div");
      cell.textContent = v || "";
      if (v === "X") cell.style.color = "var(--c-bfs)";
      if (v === "O") cell.style.color = "var(--c-dfs)";
      div.appendChild(cell);
    });
    return div;
  }

  // ---------- 페이지 로직 ----------

  document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("tttBoard");
    const editBoardEl = document.getElementById("tttEditBoard");
    const turnLabel = document.getElementById("turnLabel");
    const presetBtns = document.querySelectorAll("[data-preset]");
    const clearBtn = document.getElementById("clearBoardBtn");
    const heuristicSelect = document.getElementById("heuristicSelectTtt");
    const algoRadios = document.querySelectorAll('input[name="algoTtt"]');
    const speedRange = document.getElementById("speedRangeTtt");
    const loadBtn = document.getElementById("loadBtnTtt");
    const playBtn = document.getElementById("playBtnTtt");
    const pauseBtn = document.getElementById("pauseBtnTtt");
    const stepBtn = document.getElementById("stepBtnTtt");
    const statusLine = document.getElementById("statusLineTtt");
    const statExpansions = document.getElementById("statExpansionsTtt");
    const statGenerated = document.getElementById("statGeneratedTtt");
    const statFrontier = document.getElementById("statFrontierTtt");
    const frontierList = document.getElementById("frontierListTtt");
    const logList = document.getElementById("logListTtt");
    const pathStrip = document.getElementById("pathStripTtt");
    const pathSection = document.getElementById("pathSectionTtt");
    const compareBtn = document.getElementById("compareBtnTtt");
    const compareBody = document.getElementById("compareBodyTtt");
    const compareSection = document.getElementById("compareSectionTtt");
    const captionEl = document.getElementById("vizCaptionTtt");
    const treeViewEl = document.getElementById("treeViewTtt");

    let runner = null;
    const treeTracker = new Visualizer.TreeTracker(formatNode);
    treeTracker.renderInto(treeViewEl);

    function refreshEditor() {
      renderBoard(editBoardEl, currentInitial, true, onCellClick);
      const { x, o } = countMarks(currentInitial);
      const player = nextPlayer(currentInitial);
      turnLabel.innerHTML = `X: ${x}개 · O: ${o}개 · 다음 차례: <strong style="color:${
        player === "X" ? "var(--c-bfs)" : "var(--c-dfs)"
      }">${player}</strong>`;
    }

    function onCellClick(i) {
      const cur = currentInitial[i];
      const nextVal = cur === null ? "X" : cur === "X" ? "O" : null;
      currentInitial = currentInitial.slice();
      currentInitial[i] = nextVal;
      refreshEditor();
      renderBoard(boardEl, currentInitial, false);
      resetStats();
      pathSection.style.display = "none";
      captionEl.textContent = "초기 상태 (아직 탐색을 시작하지 않았습니다)";
    }

    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        currentInitial = PRESETS[btn.dataset.preset].slice();
        refreshEditor();
        renderBoard(boardEl, currentInitial, false);
        resetStats();
        pathSection.style.display = "none";
        captionEl.textContent = "초기 상태 (아직 탐색을 시작하지 않았습니다)";
      });
    });

    clearBtn.addEventListener("click", () => {
      currentInitial = Array(9).fill(null);
      refreshEditor();
      renderBoard(boardEl, currentInitial, false);
      resetStats();
      pathSection.style.display = "none";
    });

    function selectedAlgo() {
      return Array.from(algoRadios).find((r) => r.checked).value;
    }

    function updateHeuristicEnabled() {
      const algo = selectedAlgo();
      const uses = algo === "greedy" || algo === "astar";
      heuristicSelect.disabled = !uses;
    }
    algoRadios.forEach((r) => r.addEventListener("change", updateHeuristicEnabled));
    updateHeuristicEnabled();

    function resetStats() {
      statExpansions.textContent = "0";
      statGenerated.textContent = "0";
      statFrontier.textContent = "0";
      frontierList.innerHTML = "";
      logList.innerHTML = "";
      statusLine.className = "status-line info";
      statusLine.textContent = "탐색 시작 대기 중";
      treeTracker.reset();
      treeTracker.renderInto(treeViewEl);
    }

    function onStep(step) {
      if (!step) return;
      statExpansions.textContent = step.expansions;
      statGenerated.textContent = step.generated;
      statFrontier.textContent = step.frontierSize;

      Visualizer.renderFrontier(frontierList, step.frontier, step.strategy.key, formatNode, step.frontierSize);
      treeTracker.ingest(step);
      treeTracker.renderInto(treeViewEl);

      if (step.type === "expand" || step.type === "goal") {
        renderBoard(boardEl, step.node.state, false);
        captionEl.textContent =
          `${step.expansions}번째 확장 노드 · depth=${step.node.depth} · g=${step.node.g}` +
          (step.strategy.usesHeuristic ? ` · h=${step.node.h} · f=${step.node.f}` : "") +
          (step.node.action ? ` · 방금 수행한 동작: ${step.node.action}` : "");
        Visualizer.appendLog(logList, step, formatNode);
      }

      if (step.type === "start") {
        statusLine.className = "status-line info";
        statusLine.textContent = `${step.strategy.name} 진행 중 · 프론티어 자료구조: ${step.strategy.frontierName}`;
      } else if (step.type === "goal") {
        statusLine.className = "status-line good";
        statusLine.textContent = `X 승리 경로 발견! 총 ${step.path.length - 1}수 진행 (확장 노드 ${step.expansions}개)`;
        showPath(step.path);
      } else if (step.type === "fail") {
        statusLine.className = "status-line warn";
        statusLine.textContent = "이 초기 배치에서는 X가 승리하는 경로를 찾지 못했습니다 (무승부/O 승리만 존재).";
      } else if (step.type === "limit") {
        statusLine.className = "status-line warn";
        statusLine.textContent = `최대 탐색 노드 수(${step.expansions})에 도달했습니다. 빈 보드는 상태 공간이 매우 커서 맹목적 탐색이 비효율적일 수 있음을 보여줍니다.`;
      }
    }

    function showPath(path) {
      pathSection.style.display = "block";
      pathStrip.innerHTML = "";
      path.forEach((node, idx) => {
        pathStrip.appendChild(renderMiniBoard(node.state));
        if (idx < path.length - 1) {
          const arrow = document.createElement("span");
          arrow.className = "path-arrow";
          arrow.textContent = "→";
          pathStrip.appendChild(arrow);
        }
      });
    }

    function load() {
      const algo = selectedAlgo();
      resetStats();
      pathSection.style.display = "none";
      renderBoard(boardEl, currentInitial, false);
      runner = new Visualizer.SearchRunner({
        problem: makeProblem(),
        formatNode,
        onStep,
        maxExpansions: 15000,
      });
      runner.load(algo);
      playBtn.disabled = false;
      stepBtn.disabled = false;
      pauseBtn.disabled = true;
    }
    loadBtn.addEventListener("click", load);

    playBtn.addEventListener("click", () => {
      if (!runner) return;
      const speed = 620 - speedRange.value * 5.6;
      runner.play(Math.max(10, speed));
      playBtn.disabled = true;
      pauseBtn.disabled = false;
    });
    pauseBtn.addEventListener("click", () => {
      if (!runner) return;
      runner.pause();
      playBtn.disabled = false;
      pauseBtn.disabled = true;
    });
    stepBtn.addEventListener("click", () => {
      if (!runner) return;
      runner.step();
    });

    compareBtn.addEventListener("click", () => {
      compareSection.style.display = "block";
      compareBody.innerHTML = "";
      const keys = ["bfs", "dfs", "greedy", "astar"];
      keys.forEach((key) => {
        const strat = SearchEngine.STRATEGIES[key];
        const t0 = performance.now();
        let result = null;
        for (const step of SearchEngine.runSearch(makeProblem(), key, { maxExpansions: 15000 })) {
          if (step.type === "goal" || step.type === "fail" || step.type === "limit") {
            result = step;
            break;
          }
        }
        const t1 = performance.now();
        const pathLen = result && result.type === "goal" ? result.path.length - 1 : "-";
        const outcome =
          result.type === "goal" ? "성공" : result.type === "limit" ? "노드 제한 초과" : "승리 경로 없음";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><span class="badge ${key}"><span class="badge-dot"></span>${strat.name}</span></td>
          <td>${outcome}</td>
          <td>${pathLen}</td>
          <td>${result.expansions}</td>
          <td>${result.generated}</td>
          <td>${(t1 - t0).toFixed(1)}ms</td>
        `;
        compareBody.appendChild(tr);
      });
    });

    // 초기 표시: '한 수만 남음' 프리셋으로 시작
    currentInitial = PRESETS.short.slice();
    refreshEditor();
    renderBoard(boardEl, currentInitial, false);
    resetStats();
  });
})();
