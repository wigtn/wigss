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
                    if (count > 500 || depth > 8) return;
                    if (!(node instanceof HTMLElement)) return;
                    var tag = node.tagName.toUpperCase();
                    if (SKIP.indexOf(tag) >= 0) return;
                    var cs = window.getComputedStyle(node);
                    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
                    var r = node.getBoundingClientRect();
                    if (r.width < 4 || r.height < 4) return;
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

                // Also auto-send on load (no need to wait for request)
                function autoScan() {
                  if (window.parent === window) return; // not in iframe
                  console.log('[demo-target] Auto-scanning elements...');
                  var elements = scanElements();
                  console.log('[demo-target] Auto-sending', elements.length, 'elements');
                  window.parent.postMessage({
                    type: 'wigss-scan-result',
                    elements: elements,
                    viewport: { width: window.innerWidth, height: document.documentElement.scrollHeight }
                  }, '*');
                }
                setTimeout(autoScan, 2000);
                setTimeout(autoScan, 5000);

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
