# AI 탐색 알고리즘 시각화 학습 사이트

고등학교 「인공지능 기초」 수업의 탐색 단원을 위한 학습용 웹앱입니다.
너비 우선 탐색(BFS), 깊이 우선 탐색(DFS), 맹목적 탐색, 최상 우선 탐색, 경험적 탐색을
하나의 분류 체계로 정리하고, 8-퍼즐과 틱택토를 직접 풀어보며 각 알고리즘의 동작을
단계별로 시각화합니다.

빌드 도구나 서버 없이 **순수 HTML/CSS/JavaScript**로만 만들어져 있어 GitHub Pages에
그대로 올리면 바로 동작합니다.

## 구성

모든 파일이 **폴더 구분 없이 한 단계(루트)** 에 들어있습니다. GitHub 웹사이트의
"Add file → Upload files"로 올릴 때 하위 폴더 구조가 깨지는 문제를 피하기 위해
일부러 폴더를 만들지 않았습니다.

```
index.html          홈 (분류 체계 다이어그램, 개요)
concepts.html        개념 학습 (탭으로 알고리즘별 정의·의사코드·장단점 비교)
puzzle8.html         8-퍼즐 시뮬레이터
tictactoe.html       틱택토 게임트리 탐색 시뮬레이터
style.css            공용 스타일시트
search-engine.js     BFS/DFS/최상우선탐색/A* 공용 탐색 엔진 (제너레이터 기반)
visualizer.js        재생/일시정지/스텝 컨트롤 + 프론티어·로그 렌더링 공용 모듈
puzzle8.js           8-퍼즐 문제 정의 및 페이지 로직
tictactoe.js         틱택토 문제 정의 및 페이지 로직
```

## 로컬에서 미리보기

브라우저 보안 정책상 `file://`로 직접 열면 일부 기능이 제한될 수 있으므로,
간단한 로컬 서버로 실행하는 것을 권장합니다.

```bash
cd ai-search-visualizer
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## GitHub Pages로 배포하는 방법

### 방법 A — 웹 브라우저만 사용 (터미널/Git 몰라도 OK)

1. GitHub에서 새 저장소를 만듭니다 (예: `ai-search-visualizer`).
2. 저장소 페이지에서 **Add file → Upload files**를 클릭합니다.
3. 압축 해제한 `ai-search-visualizer` 폴더 **안에 있는 파일들을 전부 선택**해서
   (폴더째로 드래그하지 말고, 폴더를 연 다음 안의 파일들을 Ctrl/Cmd+A로 모두 선택)
   업로드 영역에 드래그하거나 "choose your files"로 첨부합니다.
   - ⚠️ 이 프로젝트는 파일이 전부 한 단계(루트)에 있으므로, 개별 파일을 그대로
     업로드하면 됩니다. 폴더 구조를 신경 쓸 필요가 없습니다.
4. 아래로 스크롤해 **Commit changes**를 누릅니다.
5. 저장소 페이지에서 **Settings → Pages**로 이동합니다.
6. "Build and deployment" 항목에서 **Source: Deploy from a branch**를 선택하고,
   **Branch: main / (root)** 를 선택한 뒤 저장합니다.
7. 1~2분 뒤 `https://<사용자명>.github.io/<저장소명>/` 주소로 사이트가 공개됩니다.
   (주소 끝의 `index.html`은 생략해도 됩니다.)

### 방법 B — Git 명령어 사용

```bash
cd ai-search-visualizer
git init
git add .
git commit -m "AI 탐색 알고리즘 시각화 사이트 초기 커밋"
git branch -M main
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git push -u origin main
```

이후 Settings → Pages 설정은 방법 A의 5~7단계와 동일합니다.

> 별도의 빌드 과정이 없으므로 위 설정만으로 충분합니다. `index.html`이 저장소
> 루트에 있어야 하며, 이 프로젝트는 이미 그렇게 구성되어 있습니다.

### 이미 배포했는데 스타일이 깨져서 보인다면

십중팔구 `style.css`나 `.js` 파일이 저장소에 실제로 올라가지 않았거나, 예전 버전
(하위 폴더 `css/`, `js/`를 사용하던 버전)을 올린 경우입니다. 저장소의 파일 목록이
정확히 위 "구성" 표와 같은 파일들로만 이루어져 있는지 확인하고, 다르다면 저장소의
기존 파일을 모두 삭제한 뒤 이 폴더의 파일들로 다시 업로드하세요.

## 다루는 개념

- **맹목적 탐색 (Blind / Uninformed Search)**
  - 너비 우선 탐색 (BFS) — 큐(FIFO) 기반, 최단 경로 보장
  - 깊이 우선 탐색 (DFS) — 스택(LIFO) 기반, 메모리 효율적 (8-퍼즐에서는 깊이 제한 탐색 적용)
- **경험적 탐색 (Heuristic / Informed Search)**
  - 최상 우선 탐색 (Best-First / Greedy) — h(n) 최소 기준
  - A* 탐색 — f(n) = g(n) + h(n) 최소 기준, 조건을 만족하면 최적 경로 보장

## 시뮬레이터

- **8-퍼즐**: 난이도별로 무작위로 섞은 3×3 퍼즐을 4가지 알고리즘으로 풀어보고,
  확장 노드 수·생성 노드 수·경로 길이를 비교할 수 있습니다.
- **틱택토**: 보드를 직접 편집하거나 프리셋을 선택해, X가 승리하는 경로를
  게임 트리 탐색으로 찾아봅니다. (상대의 최선 대응을 가정하는 미니맥스가 아닌,
  상태공간 탐색의 관점에서 다루는 단순화된 예시입니다.)

## 라이선스 / 활용

교육 목적으로 자유롭게 수정·배포하여 사용하세요.
