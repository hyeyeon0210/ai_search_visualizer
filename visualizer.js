/* ==========================================================================
   visualizer.js
   BFS/DFS/최상우선탐색/A* 시뮬레이터 공용 UI 로직.
   - 재생/일시정지/한 스텝/속도 조절 컨트롤
   - 프론티어(큐/스택/우선순위 큐) 목록 렌더링
   - 확장 로그 렌더링
   - 통계(확장 노드 수 등) 업데이트
   각 문제(8-퍼즐, 틱택토) 페이지는 이 모듈이 제공하는 SearchRunner를 사용하고,
   보드를 그리는 부분만 자체적으로 구현합니다.
   ========================================================================== */

(function (global) {
  "use strict";

  class SearchRunner {
    /**
     * @param {object} opts
     *   problem       - SearchEngine 문제 정의
     *   formatNode    - (node) => 짧은 문자열 (프론티어/로그 표시용)
     *   onStep        - (stepResult) => void  매 스텝마다 호출
     *   onFinish      - (stepResult) => void  탐색 종료(goal/fail/limit) 시 호출
     *   maxExpansions - 최대 확장 노드 수 (안전장치)
     *   depthLimitFor - (strategyKey) => number|undefined  전략별 깊이 제한 (선택)
     */
    constructor(opts) {
      this.problem = opts.problem;
      this.formatNode = opts.formatNode || ((n) => (n ? String(n.id) : ""));
      this.onStep = opts.onStep || (() => {});
      this.onFinish = opts.onFinish || (() => {});
      this.maxExpansions = opts.maxExpansions || 20000;
      this.depthLimitFor = opts.depthLimitFor || (() => undefined);
      this.gen = null;
      this.timer = null;
      this.finished = true;
      this.stepCount = 0;
    }

    load(strategyKey) {
      this.pause();
      this.strategyKey = strategyKey;
      this.gen = SearchEngine.runSearch(this.problem, strategyKey, {
        maxExpansions: this.maxExpansions,
        depthLimit: this.depthLimitFor(strategyKey),
      });
      this.finished = false;
      this.stepCount = 0;
      // 'start' 이벤트를 즉시 한 번 방출
      const first = this.gen.next();
      this.stepCount++;
      this.onStep(first.value, this.stepCount);
      if (first.done) this.finished = true;
      return first.value;
    }

    step() {
      if (!this.gen || this.finished) return null;
      const res = this.gen.next();
      this.stepCount++;
      if (res.done) {
        this.finished = true;
        this.pause();
        return null;
      }
      this.onStep(res.value, this.stepCount);
      if (res.value.type === "goal" || res.value.type === "fail" || res.value.type === "limit") {
        this.finished = true;
        this.pause();
        this.onFinish(res.value);
      }
      return res.value;
    }

    play(intervalMs) {
      this.pause();
      if (this.finished) return;
      this.timer = setInterval(() => {
        this.step();
        if (this.finished) this.pause();
      }, intervalMs);
    }

    pause() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    isPlaying() {
      return !!this.timer;
    }
  }

  // ---------- 렌더링 유틸 ----------

  function strategyBadgeClass(strategyKey) {
    return { bfs: "bfs", dfs: "dfs", greedy: "greedy", astar: "astar" }[strategyKey] || "";
  }

  /** 프론티어(큐/스택/PQ) 목록을 <ul class="frontier-list">에 렌더링 */
  function renderFrontier(container, frontierNodes, strategyKey, formatNode, frontierSizeTotal) {
    container.innerHTML = "";
    if (!frontierNodes || frontierNodes.length === 0) {
      const li = document.createElement("li");
      li.textContent = "(비어 있음)";
      li.style.opacity = "0.6";
      container.appendChild(li);
      return;
    }
    const isStack = strategyKey === "dfs";
    const headLabel = isStack ? "꼭대기(TOP) →" : "다음 꺼낼 순서 →";
    frontierNodes.forEach((node, idx) => {
      const li = document.createElement("li");
      const displayIdx = isStack ? frontierNodes.length - 1 - idx : idx;
      if (idx === 0) li.classList.add("head");
      const label = document.createElement("span");
      label.textContent = `${idx === 0 ? headLabel : "·"} ${formatNode(node)}`;
      const meta = document.createElement("span");
      meta.style.color = "var(--text-muted)";
      const parts = [];
      if (node.g != null) parts.push(`g=${node.g}`);
      if (node.h != null && (strategyKey === "greedy" || strategyKey === "astar")) parts.push(`h=${node.h}`);
      if (strategyKey === "astar") parts.push(`f=${node.f}`);
      meta.textContent = parts.join(" ");
      li.appendChild(label);
      li.appendChild(meta);
      container.appendChild(li);
    });
    if (frontierSizeTotal && frontierSizeTotal > frontierNodes.length) {
      const li = document.createElement("li");
      li.style.opacity = "0.6";
      li.textContent = `… 외 ${frontierSizeTotal - frontierNodes.length}개 (표시 생략)`;
      container.appendChild(li);
    }
  }

  /** 확장 로그를 <ul class="log-list">에 append */
  function appendLog(container, stepResult, formatNode, stepIndex) {
    if (!stepResult || (stepResult.type !== "expand" && stepResult.type !== "goal")) return;
    const node = stepResult.node;
    const li = document.createElement("li");
    if (stepResult.type === "goal") li.classList.add("expand-goal");
    const label = document.createElement("span");
    label.textContent = `#${stepResult.expansions} ${stepResult.type === "goal" ? "🎯 목표 도달: " : "확장: "}${formatNode(node)}`;
    const meta = document.createElement("span");
    meta.style.color = "var(--text-muted)";
    const parts = [`depth=${node.depth}`, `g=${node.g}`];
    if (stepResult.strategy.usesHeuristic) parts.push(`h=${node.h}`, `f=${node.f}`);
    meta.textContent = parts.join(" ");
    li.appendChild(label);
    li.appendChild(meta);
    container.appendChild(li);
    container.scrollTop = container.scrollHeight;
  }

  function clearContainer(el) {
    el.innerHTML = "";
  }

  global.Visualizer = {
    SearchRunner,
    renderFrontier,
    appendLog,
    clearContainer,
    strategyBadgeClass,
  };
})(window);
