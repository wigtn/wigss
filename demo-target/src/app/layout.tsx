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
                var SKIP = ['SCRIPT','STYLE','NOSCRIPT','META','LINK','HEAD','BR','HR','SVG','PATH'];

                function reportHeight() {
                  var h = document.documentElement.scrollHeight;
                  window.parent.postMessage({ type: 'wigss-page-height', height: h }, '*');
                }

                function scanElements() {
                  var results = [];
                  var count = 0;
                  function walk(node, depth) {
                    if (count > 200 || depth > 6) return;
                    if (!(node instanceof HTMLElement)) return;
                    var tag = node.tagName.toUpperCase();
                    if (SKIP.indexOf(tag) >= 0) return;
                    // Skip tiny inline elements (spans inside text, etc.)
                    if (['SPAN','A','STRONG','EM','B','I','SMALL','CODE'].indexOf(tag) >= 0 && !node.getAttribute('data-component')) {
                      // Still recurse into children
                      if (depth < 6) {
                        for (var ci = 0; ci < node.children.length; ci++) {
                          walk(node.children[ci], depth + 1);
                        }
                      }
                      return;
                    }
                    var cs = window.getComputedStyle(node);
                    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
                    var r = node.getBoundingClientRect();
                    // Minimum area: 30x20px (skip tiny decorative elements)
                    if (r.width < 30 || r.height < 20) return;
                    count++;
                    var attrs = {};
                    ['id','class','data-component','role','href','src','alt'].forEach(function(a) {
                      if (node.getAttribute(a)) attrs[a] = node.getAttribute(a);
                    });
                    var text = '';
                    node.childNodes.forEach(function(c) {
                      if (c.nodeType === 3) text += (c.textContent || '').trim() + ' ';
                    });
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
                      depth: depth
                    });
                    if (depth < 8) {
                      for (var i = 0; i < node.children.length; i++) {
                        walk(node.children[i], depth + 1);
                      }
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
                window.addEventListener('message', function(e) {
                  if (e.data && e.data.type === 'wigss-live-style') {
                    var className = e.data.className;
                    var styles = e.data.styles;
                    if (!className || !styles) return;
                    // Find element by matching className substring
                    var allElements = document.querySelectorAll('*');
                    for (var i = 0; i < allElements.length; i++) {
                      var el = allElements[i];
                      if (el.className && typeof el.className === 'string' && el.className.includes(className)) {
                        for (var prop in styles) {
                          el.style[prop] = styles[prop];
                        }
                        break;
                      }
                    }
                  }
                  // Reset all inline styles (on re-scan or save)
                  if (e.data && e.data.type === 'wigss-reset-styles') {
                    var allEls = document.querySelectorAll('*');
                    for (var j = 0; j < allEls.length; j++) {
                      allEls[j].removeAttribute('style');
                    }
                  }
                });

                // No auto-scan — only respond to explicit wigss-scan-request

                window.addEventListener('load', reportHeight);
                window.addEventListener('resize', function() {
                  reportHeight();
                  // Also report updated elements on resize
                  var elements = scanElements();
                  window.parent.postMessage({
                    type: 'wigss-scan-result',
                    elements: elements,
                    viewport: { width: window.innerWidth, height: document.documentElement.scrollHeight }
                  }, '*');
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
