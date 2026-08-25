/* ==========================================================================
   puzzle8.js - 8-퍼즐 탐색 시뮬레이터
   ========================================================================== */

(function () {
  "use strict";

  const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 0 = 빈칸
  let currentInitial = GOAL.slice();
  let heuristicType = "manhattan"; // 'manhattan' | 'misplaced'
  let currentScrambleSteps = 12;

  // DFS는 프론티어가 스택이라 운이 나쁘면 한없이 엉뚱한 방향으로 파고들 수 있습니다.
  // 이를 막기 위해 "깊이 제한 탐색(Depth-Limited Search)" 기법을 적용합니다.
  // 초기 배치는 목표에서 정확히 currentScrambleSteps번 이내로 섞였으므로,
  // 그 깊이까지만 허용해도 해가 항상 존재함이 보장됩니다.
  function depthLimitFor(strategyKey) {
    return strategyKey === "dfs" ? currentScrambleSteps : undefined;
  }

  // ---------- 문제 정의 ----------

  function stateKey(state) {
    return state.join(",");
  }

  function goalTest(state) {
    return stateKey(state) === stateKey(GOAL);
  }

  function successors(state) {
    const blank = state.indexOf(0);
    const row = Math.floor(blank / 3);
    const col = blank % 3;
    const moves = [];
    if (row > 0) moves.push({ swap: blank - 3, action: "⬆ 빈칸 위로 이동" });
    if (row < 2) moves.push({ swap: blank + 3, action: "⬇ 빈칸 아래로 이동" });
    if (col > 0) moves.push({ swap: blank - 1, action: "⬅ 빈칸 왼쪽으로 이동" });
    if (col < 2) moves.push({ swap: blank + 1, action: "➡ 빈칸 오른쪽으로 이동" });

    return moves.map(({ swap, action }) => {
      const next = state.slice();
      next[blank] = next[swap];
      next[swap] = 0;
      return { state: next, action, stepCost: 1 };
    });
  }

  function manhattan(state) {
    let total = 0;
    for (let i = 0; i < 9; i++) {
      const v = state[i];
      if (v === 0) continue;
      const goalIdx = v - 1;
      const r1 = Math.floor(i / 3), c1 = i % 3;
      const r2 = Math.floor(goalIdx / 3), c2 = goalIdx % 3;
      total += Math.abs(r1 - r2) + Math.abs(c1 - c2);
    }
    return total;
  }

  function misplaced(state) {
    let total = 0;
    for (let i = 0; i < 9; i++) {
      if (state[i] !== 0 && state[i] !== GOAL[i]) total++;
    }
    return total;
  }

  function heuristic(state) {
    return heuristicType === "manhattan" ? manhattan(state) : misplaced(state);
  }

  function makeProblem() {
    return {
      initialState: currentInitial,
      goalTest,
      successors,
      heuristic,
      stateKey,
    };
  }

  // 목표에서부터 무작위로 합법적인 이동을 N번 수행해 항상 "풀 수 있는" 초기 배치를 만든다
  function scramble(steps) {
    let state = GOAL.slice();
    let lastBlank = -1;
    for (let i = 0; i < steps; i++) {
      const succ = successors(state).filter((s) => {
        const newBlank = s.state.indexOf(0);
        return newBlank !== lastBlank; // 직전 수를 그대로 되돌리지 않도록
      });
      const pick = succ[Math.floor(Math.random() * succ.length)];
      lastBlank = state.indexOf(0);
      state = pick.state;
    }
    return state;
  }

  // ---------- 렌더링 ----------

  function renderBoard(container, state, opts = {}) {
    container.innerHTML = "";
    state.forEach((v) => {
      const tile = document.createElement("div");
      tile.className = "puzzle-tile" + (v === 0 ? " blank" : "");
      tile.textContent = v === 0 ? "" : v;
      container.appendChild(tile);
    });
  }

  function formatNode(node) {
    return node.state.map((v) => (v === 0 ? "_" : v)).join("");
  }

  function renderMiniBoard(state) {
    const div = document.createElement("div");
    div.className = "path-mini-board";
    state.forEach((v) => {
      const cell = document.createElement("div");
      cell.textContent = v === 0 ? "" : v;
      div.appendChild(cell);
    });
    return div;
  }

  // ---------- 페이지 로직 ----------

  document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("puzzleBoard");
    const goalMiniEl = document.getElementById("goalBoardMini");
    const difficultySelect = document.getElementById("difficultySelect");
    const scrambleBtn = document.getElementById("scrambleBtn");
    const heuristicSelect = document.getElementById("heuristicSelect");
    const algoRadios = document.querySelectorAll('input[name="algo"]');
    const speedRange = document.getElementById("speedRange");
    const loadBtn = document.getElementById("loadBtn");
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const stepBtn = document.getElementById("stepBtn");
    const statusLine = document.getElementById("statusLine");
    const statExpansions = document.getElementById("statExpansions");
    const statGenerated = document.getElementById("statGenerated");
    const statFrontier = document.getElementById("statFrontier");
    const frontierList = document.getElementById("frontierList");
    const logList = document.getElementById("logList");
    const pathStrip = document.getElementById("pathStrip");
    const pathSection = document.getElementById("pathSection");
    const compareBtn = document.getElementById("compareBtn");
    const compareBody = document.getElementById("compareBody");
    const compareSection = document.getElementById("compareSection");
    const captionEl = document.getElementById("vizCaption");
    const treeViewEl = document.getElementById("treeView");

    renderBoard(goalMiniEl, GOAL);

    let runner = null;
    const treeTracker = new Visualizer.TreeTracker(formatNode);
    treeTracker.renderInto(treeViewEl);

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

    heuristicSelect.addEventListener("change", () => {
      heuristicType = heuristicSelect.value;
    });

    function doScramble() {
      const level = difficultySelect.value;
      const steps = { veryeasy: 2, easy: 6, medium: 12, hard: 22 }[level] || 10;
      currentScrambleSteps = steps;
      currentInitial = scramble(steps);
      renderBoard(boardEl, currentInitial);
      captionEl.textContent = "초기 상태 (아직 탐색을 시작하지 않았습니다)";
      resetStats();
      pathSection.style.display = "none";
      if (runner) runner.pause();
    }

    scrambleBtn.addEventListener("click", doScramble);

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
        renderBoard(boardEl, step.node.state);
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
        statusLine.textContent = `목표 상태 도달! 총 ${step.path.length - 1}번의 이동으로 해결 (확장 노드 ${step.expansions}개)`;
        showPath(step.path);
      } else if (step.type === "fail") {
        statusLine.className = "status-line warn";
        statusLine.textContent = "프론티어가 비어 목표를 찾지 못했습니다.";
      } else if (step.type === "limit") {
        statusLine.className = "status-line warn";
        statusLine.textContent = `최대 탐색 노드 수(${step.expansions})에 도달해 중단했습니다. 더 쉬운 난이도를 시도해 보세요.`;
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
      renderBoard(boardEl, currentInitial);
      runner = new Visualizer.SearchRunner({
        problem: makeProblem(),
        formatNode,
        onStep,
        maxExpansions: 30000,
        depthLimitFor,
      });
      runner.load(algo);
      playBtn.disabled = false;
      stepBtn.disabled = false;
      pauseBtn.disabled = true;
    }

    loadBtn.addEventListener("click", load);

    playBtn.addEventListener("click", () => {
      if (!runner) return;
      const speed = 620 - speedRange.value * 5.6; // 느림(120) ~ 빠름(20ms)
      runner.play(Math.max(20, speed));
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

    // ---------- 4개 알고리즘 비교 ----------

    compareBtn.addEventListener("click", () => {
      compareSection.style.display = "block";
      compareBody.innerHTML = "";
      const keys = ["bfs", "dfs", "greedy", "astar"];
      keys.forEach((key) => {
        const strat = SearchEngine.STRATEGIES[key];
        const t0 = performance.now();
        let result = null;
        let steps = 0;
        for (const step of SearchEngine.runSearch(makeProblem(), key, {
          maxExpansions: 30000,
          depthLimit: depthLimitFor(key),
        })) {
          steps++;
          if (step.type === "goal" || step.type === "fail" || step.type === "limit") {
            result = step;
            break;
          }
        }
        const t1 = performance.now();
        const tr = document.createElement("tr");
        const pathLen = result && result.type === "goal" ? result.path.length - 1 : "-";
        const outcome =
          result.type === "goal" ? "성공" : result.type === "limit" ? "노드 제한 초과" : "실패";
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

    // 초기 표시
    doScramble();
  });
})();
