// The approved, fixed print sheet has a local layout; it must still satisfy
// navigation, branding and print requirements. Other pages keep the shared layout.
export const inspectPrintListLayout = ({ pathname, html, css = '' }) => {
  if (pathname !== '/de/demenz-alltagstipps.html') return { registered: false, errors: [] };
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  require(/<link\b[^>]*rel="stylesheet"[^>]*href="\/teller\/liste\.css"/.test(html), 'print list missing its local stylesheet');
  require(/<header>[\s\S]*?<a class="brand" href="\/de\/">[\s\S]*?<img[^>]*src="\/assets\/lovable-logo\.jpg"/.test(html), 'print list missing branded home navigation');
  require(/<details class="site-menu">[\s\S]*?<summary>Menü<\/summary>[\s\S]*?<nav aria-label="Hauptnavigation">/.test(html), 'print list missing native accessible menu');
  require(/<button[^>]*data-font-toggle[^>]*aria-pressed="(?:false|true)"/.test(html), 'print list missing accessible text-size control');
  require(/<button[^>]*data-print-list/.test(html), 'print list missing print action');
  require(/<script src="\/teller\/liste\.js" defer><\/script>/.test(html), 'print list missing local navigation and print script');
  require(/header\s*\{[^}]*position:sticky/.test(css), 'print list missing sticky header');
  const printCSS = css.split(/@media\s+print\s*\{/)[1] ?? '';
  require(/@page\s*\{[^}]*size:A4/.test(printCSS), 'print list missing A4 print layout');
  require(/header\s*\{[^}]*position:static/.test(printCSS), 'print list must unstick the printed header');
  require(/[^{}]*\.site-menu[^{}]*\{[^}]*display:none!important/.test(printCSS), 'print list must hide navigation in print');
  return { registered: true, errors };
};
