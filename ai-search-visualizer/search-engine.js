/* ==========================================================================
   search-engine.js
   BFS / DFS / 최상우선탐색(Greedy Best-First) / A* 를 하나의 공용 엔진으로 구현.

   문제(problem)는 다음 인터페이스를 만족해야 합니다.
     - initialState        : 시작 상태
     - goalTest(state)      : 목표 상태인지 여부(boolean)
     - successors(state)    : [{ state, action, stepCost }] 배열을 반환
     - heuristic(state)     : 휴리스틱 값 h(n) (경험적 탐색에서만 사용)
     - stateKey(state)      : 상태를 고유 문자열로 변환 (중복 방문 판정용)

   runSearch()는 제너레이터(generator)로, next()를 한 번 호출할 때마다
   "노드 하나를 확장"하는 지점까지 진행합니다. 이렇게 하면 알고리즘의
   내부 동작(프론티어, 탐험 집합, 트리 구조)을 한 스텝씩 눈으로 볼 수 있습니다.
   ========================================================================== */

(function (global) {
  "use strict";

  const STRATEGIES = {
    bfs: {
      key: "bfs",
      name: "너비 우선 탐색",
      shortName: "BFS",
      category: "blind",
      usesHeuristic: false,
      frontierName: "큐 (FIFO)",
      color: "var(--c-bfs)",
    },
    dfs: {
      key: "dfs",
      name: "깊이 우선 탐색",
      shortName: "DFS",
      category: "blind",
      usesHeuristic: false,
      frontierName: "스택 (LIFO)",
      color: "var(--c-dfs)",
    },
    greedy: {
      key: "greedy",
      name: "최상 우선 탐색",
      shortName: "Greedy Best-First",
      category: "heuristic",
      usesHeuristic: true,
      frontierName: "우선순위 큐 (h(n) 최소)",
      color: "var(--c-greedy)",
    },
    astar: {
      key: "astar",
      name: "A* 탐색",
      shortName: "A*",
      category: "heuristic",
      usesHeuristic: true,
      frontierName: "우선순위 큐 (f(n)=g(n)+h(n) 최소)",
      color: "var(--c-astar)",
    },
  };

  let _idCounter = 0;

  class SearchNode {
    constructor(state, parent, action, depth, g, h) {
      this.state = state;
      this.parent = parent;
      this.action = action;
      this.depth = depth;
      this.g = g;
      this.h = h;
      this.f = g + h;
      this.id = _idCounter++;
    }
  }

  function reconstructPath(node) {
    const path = [];
    let cur = node;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent;
    }
    return path;
  }

  // 매우 단순한 우선순위 큐 (정렬 기반). 교육용 규모에서는 성능에 문제 없음.
  class SimplePriorityQueue {
    constructor(compareFn) {
      this._items = [];
      this._cmp = compareFn;
    }
    push(item) {
      this._items.push(item);
      this._items.sort(this._cmp);
    }
    shift() {
      return this._items.shift();
    }
    get length() {
      return this._items.length;
    }
    toArray() {
      return this._items;
    }
  }

  /**
   * 탐색 과정을 스텝 단위로 진행하는 제너레이터.
   * @param {object} problem
   * @param {string} strategyKey - 'bfs' | 'dfs' | 'greedy' | 'astar'
   * @param {object} options - { maxExpansions, depthLimit }
   *   depthLimit: 지정하면 이 깊이보다 깊은 자손 노드는 생성하지 않음
   *   (특히 DFS가 엉뚱한 방향으로 한없이 깊게 파고드는 것을 막는
   *    "깊이 제한 탐색(Depth-Limited Search)" 기법에 사용)
   */
  function* runSearch(problem, strategyKey, options = {}) {
    const maxExpansions = options.maxExpansions || 20000;
    const depthLimit = options.depthLimit != null ? options.depthLimit : Infinity;
    _idCounter = 0;

    const strat = STRATEGIES[strategyKey];
    if (!strat) throw new Error("알 수 없는 탐색 전략: " + strategyKey);

    const rootH = problem.heuristic ? problem.heuristic(problem.initialState) : 0;
    const root = new SearchNode(problem.initialState, null, null, 0, 0, rootH);

    const isPQ = strategyKey === "greedy" || strategyKey === "astar";
    let frontier;
    if (strategyKey === "bfs" || strategyKey === "dfs") {
      frontier = [root];
    } else if (strategyKey === "greedy") {
      frontier = new SimplePriorityQueue((a, b) => a.h - b.h || a.id - b.id);
      frontier.push(root);
    } else {
      frontier = new SimplePriorityQueue((a, b) => a.f - b.f || a.id - b.id);
      frontier.push(root);
    }

    const bestG = new Map(); // stateKey -> 지금까지 발견한 최소 g
    let expansions = 0;
    let generated = 1;

    const frontierArr = () => (isPQ ? frontier.toArray() : frontier);

    yield {
      type: "start",
      strategy: strat,
      frontier: frontierArr().slice(0, 300),
      frontierSize: isPQ ? frontier.length : frontier.length,
      expansions,
      generated,
      node: null,
    };

    while ((isPQ ? frontier.length : frontier.length) > 0) {
      if (expansions >= maxExpansions) {
        yield {
          type: "limit",
          strategy: strat,
          frontier: frontierArr().slice(0, 300),
          frontierSize: isPQ ? frontier.length : frontier.length,
          expansions,
          generated,
          node: null,
        };
        return;
      }

      let node;
      if (strategyKey === "bfs") node = frontier.shift(); // 큐: 앞에서 꺼냄
      else if (strategyKey === "dfs") node = frontier.pop(); // 스택: 뒤에서 꺼냄
      else node = frontier.shift(); // 우선순위 큐: 가장 작은 값

      const key = problem.stateKey(node.state);
      if (bestG.has(key) && bestG.get(key) < node.g) {
        continue; // 이미 더 좋은 경로로 방문한 상태 -> 건너뜀
      }
      bestG.set(key, node.g);
      expansions++;

      const isGoal = problem.goalTest(node.state);

      yield {
        type: isGoal ? "goal" : "expand",
        strategy: strat,
        frontier: frontierArr().slice(0, 300),
        frontierSize: isPQ ? frontier.length : frontier.length,
        expansions,
        generated,
        node,
        path: isGoal ? reconstructPath(node) : null,
      };

      if (isGoal) {
        return;
      }

      if (node.depth >= depthLimit) continue; // 깊이 제한 도달 -> 더 이상 확장하지 않음

      const succs = problem.successors(node.state) || [];
      for (const s of succs) {
        const childKey = problem.stateKey(s.state);
        const stepCost = s.stepCost != null ? s.stepCost : 1;
        const g = node.g + stepCost;
        if (bestG.has(childKey) && bestG.get(childKey) <= g) continue;
        const h = problem.heuristic ? problem.heuristic(s.state) : 0;
        const child = new SearchNode(s.state, node, s.action, node.depth + 1, g, h);
        generated++;
        if (strategyKey === "bfs") frontier.push(child);
        else if (strategyKey === "dfs") frontier.push(child);
        else frontier.push(child);
      }
    }

    yield {
      type: "fail",
      strategy: strat,
      frontier: [],
      frontierSize: 0,
      expansions,
      generated,
      node: null,
    };
  }

  global.SearchEngine = {
    STRATEGIES,
    runSearch,
    reconstructPath,
  };
})(window);
