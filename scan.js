/**
 * wigss 스캔 런타임 (P1 · PROD-631)
 *
 * 대상 페이지 안에서 실행되어 부모(에디터)의 postMessage 프로토콜에 응답한다.
 * 이전에는 demo-target/layout.tsx 의 인라인 <script> 로만 존재해 임의의 사용자
 * 프로젝트에서는 스캔이 불가능했다. 패키지 모듈로 승격해 어떤 React 앱이든
 * 클라이언트에서 initWigssScan() 한 번으로 참여할 수 있다.
 *
 * 프로토콜 (기존과 동일 + address 추가):
 *   수신  wigss-scan-request              → 요소 스캔 후 wigss-scan-result 응답
 *   수신  wigss-live-style {className,styles} → 드래그 중 라이브 미리보기
 *   수신  wigss-reset-styles              → 라이브 스타일 원복
 *   발신  wigss-page-height {height}      → 문서 높이 보고
 *   발신  wigss-scan-result {elements, viewport}
 *
 * 각 요소 페이로드에 data-wigss 주소(file:line:col)가 address 로 실린다.
 * 주소는 wigss/jsx-dev-runtime 이 부착한다 (tsconfig "jsxImportSource": "wigss").
 */

const DEFAULTS = {
  maxElements: 300,
  maxDepth: 8,
  minWidth: 30,
  minHeight: 20,
};

const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD', 'BR', 'HR', 'SVG', 'PATH'];
const INLINE_TAGS = ['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'CODE'];
const ATTR_LIST = ['id', 'class', 'data-component', 'role', 'href', 'src', 'alt'];

function scanElements(opts) {
  const results = [];
  let count = 0;

  function walk(node, depth) {
    if (count >= opts.maxElements || depth > opts.maxDepth) return;
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toUpperCase();
    if (SKIP_TAGS.indexOf(tag) >= 0) return;

    if (INLINE_TAGS.indexOf(tag) >= 0 && !node.getAttribute('data-component')) {
      for (let ci = 0; ci < node.children.length; ci++) walk(node.children[ci], depth + 1);
      return;
    }

    const r = node.getBoundingClientRect();
    if (r.width < opts.minWidth || r.height < opts.minHeight) return;

    const cs = window.getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;

    count++;
    const attrs = {};
    for (let ai = 0; ai < ATTR_LIST.length; ai++) {
      const a = ATTR_LIST[ai];
      if (node.getAttribute(a)) attrs[a] = node.getAttribute(a);
    }
    let text = '';
    for (let ti = 0; ti < node.childNodes.length; ti++) {
      const c = node.childNodes[ti];
      if (c.nodeType === 3) text += (c.textContent || '').trim() + ' ';
    }

    const parentEl = node.parentElement;
    let parentId = null;
    if (parentEl && parentEl !== document.body) {
      parentId = parentEl.id || parentEl.getAttribute('data-component') || null;
    }

    results.push({
      id: node.id || node.getAttribute('data-component') || 'el-' + count,
      tagName: tag.toLowerCase(),
      className: typeof node.className === 'string' ? node.className : '',
      // P1: jsx-dev-runtime 이 부착한 소스 주소. 없으면 null (조인은 저하 경로로).
      address: node.getAttribute('data-wigss') || null,
      boundingBox: {
        x: Math.round(r.x + window.scrollX),
        y: Math.round(r.y + window.scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
      visible: true,
      children: [],
      attributes: attrs,
      textContent: text.trim().slice(0, 80),
      depth,
      computedStyle: {
        display: cs.display,
        position: cs.position,
        flexDirection: cs.flexDirection || '',
        gridTemplateColumns: cs.gridTemplateColumns || '',
        gap: cs.gap || '',
        justifyContent: cs.justifyContent || '',
        alignItems: cs.alignItems || '',
        color: cs.color || '',
        backgroundColor: cs.backgroundColor || '',
        fontSize: cs.fontSize || '',
        fontWeight: cs.fontWeight || '',
        borderColor: cs.borderColor || cs.borderTopColor || '',
        borderWidth: cs.borderWidth || cs.borderTopWidth || '',
        borderRadius: cs.borderRadius || cs.borderTopLeftRadius || '',
        boxShadow: cs.boxShadow || '',
      },
      childCount: node.children.length,
      parentId,
    });

    for (let i = 0; i < node.children.length; i++) walk(node.children[i], depth + 1);
  }

  const body = document.body;
  if (body) {
    for (let i = 0; i < body.children.length; i++) walk(body.children[i], 0);
  }
  return results;
}

/**
 * 스캔 런타임을 설치한다. 반환값은 해제 함수.
 * 개발 모드 전용으로 쓰는 것을 권장한다 (프로덕션 번들에서 제외).
 */
export function initWigssScan(options) {
  if (typeof window === 'undefined') return () => {};
  const opts = { ...DEFAULTS, ...(options || {}) };

  function reportHeight() {
    window.parent.postMessage(
      { type: 'wigss-page-height', height: document.documentElement.scrollHeight },
      '*',
    );
  }

  function sendScan() {
    window.parent.postMessage(
      {
        type: 'wigss-scan-result',
        elements: scanElements(opts),
        viewport: { width: window.innerWidth, height: document.documentElement.scrollHeight },
      },
      '*',
    );
  }

  const liveStyleCache = {};

  function onMessage(e) {
    const d = e.data;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'wigss-scan-request') {
      sendScan();
    } else if (d.type === 'wigss-live-style') {
      const { className, styles } = d;
      if (!className || !styles) return;
      let el = liveStyleCache[className];
      if (!el || !el.isConnected) {
        el = document.querySelector('[class*="' + String(className).split(' ')[0] + '"]');
        if (el) liveStyleCache[className] = el;
      }
      if (el) for (const prop in styles) el.style[prop] = styles[prop];
    } else if (d.type === 'wigss-reset-styles') {
      for (const k in liveStyleCache) delete liveStyleCache[k];
      const all = document.querySelectorAll('[style]');
      for (let j = 0; j < all.length; j++) all[j].removeAttribute('style');
    }
  }

  let resizeTimer;
  function onResize() {
    reportHeight();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sendScan, 250);
  }

  window.addEventListener('message', onMessage);
  window.addEventListener('load', reportHeight);
  window.addEventListener('resize', onResize);
  const mo = new MutationObserver(reportHeight);
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  const t = setTimeout(reportHeight, 500);

  return function dispose() {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('load', reportHeight);
    window.removeEventListener('resize', onResize);
    mo.disconnect();
    clearTimeout(t);
    clearTimeout(resizeTimer);
  };
}
