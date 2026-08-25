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

  // ---------- 탐색 트리 시각화 ----------

  /**
   * 지금까지 생성/확장된 노드들을 부모-자식 관계로 누적해서
   * 들여쓰기 트리(디렉터리 구조 같은 모양)로 그려주는 클래스.
   * "아주 쉬움" 난이도처럼 노드 수가 적을 때 특히 유용합니다.
   */
  class TreeTracker {
    /**
     * @param {function} formatNode
     * @param {object} opts - { cap } 추적/렌더링할 최대 노드 수.
     *   상태 공간이 큰 문제(예: 어려움 난이도, 빈 틱택토 보드)에서 매 스텝마다
     *   전체 트리를 다시 그리면 노드 수의 제곱에 비례해 느려지므로,
     *   추적 자체를 이 개수에서 멈춰(하드 캡) 성능을 보장합니다.
     */
    constructor(formatNode, opts = {}) {
      this.formatNode = formatNode;
      this.cap = opts.cap || 200;
      this.reset();
    }

    reset() {
      this.nodes = new Map(); // id -> { id, parentId, node, status, order }
      this.order = [];
      this.lastId = null;
      this.capped = false;
    }

    ingest(step) {
      if (!step || this.capped) return;
      const statusPriority = { frontier: 0, expanded: 1, goal: 2 };
      const consider = (n, status) => {
        if (!n || this.capped) return;
        let entry = this.nodes.get(n.id);
        if (!entry) {
          if (this.nodes.size >= this.cap) {
            this.capped = true;
            return;
          }
          entry = { id: n.id, parentId: n.parent ? n.parent.id : null, node: n, status, order: this.order.length };
          this.nodes.set(n.id, entry);
          this.order.push(n.id);
        } else if (statusPriority[status] > statusPriority[entry.status]) {
          entry.status = status;
        }
      };
      (step.frontier || []).forEach((n) => consider(n, "frontier"));
      if (step.node) {
        consider(step.node, step.type === "goal" ? "goal" : "expanded");
        if (!this.capped && this.nodes.has(step.node.id)) this.lastId = step.node.id;
      }
    }

    renderInto(container) {
      container.innerHTML = "";
      if (this.nodes.size === 0) {
        const empty = document.createElement("div");
        empty.className = "tree-empty";
        empty.textContent = "아직 생성된 노드가 없습니다. 탐색을 시작해보세요.";
        container.appendChild(empty);
        return;
      }
      // 등록된 노드 수는 this.cap 이하로 이미 제한되어 있으므로,
      // 아래 그룹핑/렌더링 비용은 문제의 전체 상태 공간 크기와 무관하게 일정합니다.
      const childrenOf = new Map();
      this.nodes.forEach((entry) => {
        if (entry.parentId != null && this.nodes.has(entry.parentId)) {
          if (!childrenOf.has(entry.parentId)) childrenOf.set(entry.parentId, []);
          childrenOf.get(entry.parentId).push(entry);
        }
      });
      childrenOf.forEach((list) => list.sort((a, b) => a.order - b.order));

      const buildLi = (entry) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        let cls = "tree-node-label state-" + entry.status;
        if (entry.id === this.lastId) cls += " tree-node-latest";
        span.className = cls;
        const n = entry.node;
        const labelText = document.createElement("span");
        labelText.className = "tree-node-text";
        labelText.textContent = this.formatNode(n);
        const meta = document.createElement("span");
        meta.className = "tree-node-meta";
        const metaParts = [`g=${n.g}`];
        if (n.h !== undefined && n.h !== null) metaParts.push(`h=${n.h}`);
        meta.textContent = metaParts.join(" ");
        span.appendChild(labelText);
        span.appendChild(meta);
        li.appendChild(span);

        const kids = childrenOf.get(entry.id) || [];
        if (kids.length) {
          const ul = document.createElement("ul");
          kids.forEach((k) => ul.appendChild(buildLi(k)));
          li.appendChild(ul);
        }
        return li;
      };

      const rootId = this.order[0];
      const rootEntry = this.nodes.get(rootId);
      const topUl = document.createElement("ul");
      topUl.className = "tree-list";
      topUl.appendChild(buildLi(rootEntry));
      container.appendChild(topUl);

      if (this.capped) {
        const note = document.createElement("div");
        note.className = "tree-truncated-note";
        note.textContent = `노드가 많아 ${this.cap}개까지만 추적하고 트리 표시를 멈췄습니다. "아주 쉬움"·"쉬움" 난이도에서는 트리 전체를 볼 수 있어요. (통계·프론티어·경로 결과에는 영향 없습니다)`;
        container.appendChild(note);
      }
    }
  }

  global.Visualizer = {
    SearchRunner,
    renderFrontier,
    appendLog,
    clearContainer,
    strategyBadgeClass,
    TreeTracker,
  };
})(window);
