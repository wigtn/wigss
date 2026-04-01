import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pixel Craft — Design Studio',
  description: 'A creative design studio portfolio and blog',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        {children}
        {/* WIGSS integration: report page height + provide element scanning */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var MAX_ELEMENTS = 300;
                var MAX_DEPTH = 8;
                var MIN_WIDTH = 30;
                var MIN_HEIGHT = 20;
                var SKIP = ['SCRIPT','STYLE','NOSCRIPT','META','LINK','HEAD','BR','HR','SVG','PATH'];
                var INLINE_TAGS = ['SPAN','A','STRONG','EM','B','I','SMALL','CODE'];
                var ATTR_LIST = ['id','class','data-component','role','href','src','alt'];

                function reportHeight() {
                  var h = document.documentElement.scrollHeight;
                  window.parent.postMessage({ type: 'wigss-page-height', height: h }, '*');
                }

                function scanElements() {
                  var results = [];
                  var count = 0;
                  function walk(node, depth) {
                    if (count >= MAX_ELEMENTS || depth > MAX_DEPTH) return;
                    if (!(node instanceof HTMLElement)) return;
                    var tag = node.tagName.toUpperCase();
                    if (SKIP.indexOf(tag) >= 0) return;

                    // Skip inline elements (still recurse into children)
                    if (INLINE_TAGS.indexOf(tag) >= 0 && !node.getAttribute('data-component')) {
                      for (var ci = 0; ci < node.children.length; ci++) {
                        walk(node.children[ci], depth + 1);
                      }
                      return;
                    }

                    // Size check before expensive getComputedStyle
                    var r = node.getBoundingClientRect();
                    if (r.width < MIN_WIDTH || r.height < MIN_HEIGHT) return;

                    var cs = window.getComputedStyle(node);
                    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;

                    count++;
                    var attrs = {};
                    for (var ai = 0; ai < ATTR_LIST.length; ai++) {
                      var a = ATTR_LIST[ai];
                      if (node.getAttribute(a)) attrs[a] = node.getAttribute(a);
                    }
                    var text = '';
                    for (var ti = 0; ti < node.childNodes.length; ti++) {
                      var c = node.childNodes[ti];
                      if (c.nodeType === 3) text += (c.textContent || '').trim() + ' ';
                    }

                    var parentEl = node.parentElement;
                    var parentId = null;
                    if (parentEl && parentEl !== document.body) {
                      parentId = parentEl.id || parentEl.getAttribute('data-component') || null;
                    }

                    results.push({
                      id: node.id || node.getAttribute('data-component') || 'el-' + count,
                      tagName: tag.toLowerCase(),
                      className: node.className || '',
                      boundingBox: {
                        x: Math.round(r.x + window.scrollX),
                        y: Math.round(r.y + window.scrollY),
                        width: Math.round(r.width),
                        height: Math.round(r.height)
                      },
                      visible: true,
                      children: [],
                      attributes: attrs,
                      textContent: text.trim().slice(0, 80),
                      depth: depth,
                      computedStyle: {
                        display: cs.display,
                        position: cs.position,
                        flexDirection: cs.flexDirection || '',
                        gridTemplateColumns: cs.gridTemplateColumns || '',
                        gap: cs.gap || '',
                        justifyContent: cs.justifyContent || '',
                        alignItems: cs.alignItems || ''
                      },
                      childCount: node.children.length,
                      parentId: parentId
                    });

                    for (var i = 0; i < node.children.length; i++) {
                      walk(node.children[i], depth + 1);
                    }
                  }
                  var body = document.body;
                  if (body) {
                    for (var i = 0; i < body.children.length; i++) {
                      walk(body.children[i], 0);
                    }
                  }
                  return results;
                }

                // Listen for scan requests from WIGSS
                window.addEventListener('message', function(e) {
                  if (e.data && e.data.type === 'wigss-scan-request') {
                    console.log('[demo-target] Scan request received, scanning...');
                    var elements = scanElements();
                    console.log('[demo-target] Sending', elements.length, 'elements to parent');
                    window.parent.postMessage({
                      type: 'wigss-scan-result',
                      elements: elements,
                      viewport: { width: window.innerWidth, height: document.documentElement.scrollHeight }
                    }, '*');
                  }
                });

                // Live style preview: apply inline styles during drag
                var liveStyleCache = {};
                window.addEventListener('message', function(e) {
                  if (e.data && e.data.type === 'wigss-live-style') {
                    var className = e.data.className;
                    var styles = e.data.styles;
                    if (!className || !styles) return;
                    // Cache element lookup by className for performance
                    var el = liveStyleCache[className];
                    if (!el || !el.isConnected) {
                      el = document.querySelector('[class*="' + className.split(' ')[0] + '"]');
                      if (el) liveStyleCache[className] = el;
                    }
                    if (el) {
                      for (var prop in styles) {
                        el.style[prop] = styles[prop];
                      }
                    }
                  }
                  if (e.data && e.data.type === 'wigss-reset-styles') {
                    liveStyleCache = {};
                    var allEls = document.querySelectorAll('[style]');
                    for (var j = 0; j < allEls.length; j++) {
                      allEls[j].removeAttribute('style');
                    }
                  }
                });

                // No auto-scan — only respond to explicit wigss-scan-request

                window.addEventListener('load', reportHeight);
                var resizeTimer;
                window.addEventListener('resize', function() {
                  reportHeight();
                  clearTimeout(resizeTimer);
                  resizeTimer = setTimeout(function() {
                    var elements = scanElements();
                    window.parent.postMessage({
                      type: 'wigss-scan-result',
                      elements: elements,
                      viewport: { width: window.innerWidth, height: document.documentElement.scrollHeight }
                    }, '*');
                  }, 250);
                });
                new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true });
                setTimeout(reportHeight, 500);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
