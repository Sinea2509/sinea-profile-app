const fs = require('fs'); const vm = require('vm');
function el() {
  const base = { style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){ return el(); }, removeChild(){}, insertAdjacentHTML(){}, remove(){},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){ return null; },
    querySelector(){ return el(); }, querySelectorAll(){ return []; }, closest(){ return el(); },
    focus(){}, blur(){}, click(){}, scrollTo(){}, getBoundingClientRect(){ return { width: 300, height: 200, top: 0, left: 0 }; },
    value: '', textContent: '', innerHTML: '', children: [], parentElement: null, offsetWidth: 300, offsetHeight: 200 };
  return new Proxy(base, { get(t, k) { if (k in t) return t[k]; return function () { return el(); }; }, set(){ return true; } });
}
// La mosaïque est un vrai objet : on veut voir ce que initCover y écrit.
const mosaique = { dataset: {}, innerHTML: '', style: {}, classList: { add(){}, remove(){} },
  appendChild(){}, setAttribute(){}, addEventListener(){}, querySelectorAll(){ return []; } };
const textes = {};
const document = { readyState: 'complete', addEventListener(){}, removeEventListener(){},
  getElementById(id){ if (id === 'cover-mosaic') return mosaique;
    return new Proxy({ id, style:{}, dataset:{}, classList:{ add(){}, remove(){} } },
      { get(t,k){ if (k === 'textContent') return textes[t.id] || ''; if (k in t) return t[k]; return function(){ return el(); }; },
        set(t,k,v){ if (k === 'textContent') textes[t.id] = v; t[k] = v; return true; } }); },
  querySelector(){ return el(); }, querySelectorAll(){ return []; },
  createElement(){ return el(); }, body: el(), documentElement: el(), title: '' };
const location = { search: '', origin: 'https://test', pathname: '/', href: 'https://test/' };
const windowObj = { location, addEventListener(){}, removeEventListener(){}, matchMedia(){ return { matches: false, addListener(){}, addEventListener(){} }; },
  scrollTo(){}, requestAnimationFrame(cb){ }, innerWidth: 1200, innerHeight: 800 };
const sandbox = { window: windowObj, document, location, localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  sessionStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  fetch(){ return new Promise(function(){}); }, navigator: { clipboard: { writeText(){ return Promise.resolve(); } }, userAgent: 'test' },
  console, setTimeout(cb){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
  requestAnimationFrame(){}, alert(){}, prompt(){ return ''; }, confirm(){ return true; },
  IntersectionObserver: function(){ return { observe(){}, disconnect(){} }; },
  MutationObserver: function(){ return { observe(){}, disconnect(){} }; },
  URL: URL, URLSearchParams: URLSearchParams, Image: function(){ return el(); } };
sandbox.window.document = document; sandbox.globalThis = sandbox; sandbox.self = sandbox.window;
sandbox.mosaique = mosaique; sandbox.textesCover = textes;
vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync('sinea_data.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('competences.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('engine.js', 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync('controller.js', 'utf8'), sandbox);
  const App = sandbox.window.App;
  const charge = App && typeof App.initCover === 'function' && App.c360;
  if (!charge) { console.log('ÉCHEC : window.App incomplet'); process.exit(1); }
  // On exécute vraiment la couverture et on regarde ce qu'elle a peint.
  App.initCover();
  const html = sandbox.mosaique ? sandbox.mosaique.innerHTML : '';
  const tuiles = (html.match(/cm-tile/g) || []).length;
  const webp = (html.match(/\.webp/g) || []).length;
  const nq = sandbox.textesCover ? sandbox.textesCover['cover-nq'] : null;
  const ok = tuiles === 40 && webp === 40;
  console.log(ok
    ? 'COUVERTURE PEINTE : ' + tuiles + ' vignettes de personnages, compteur = ' + nq
    : 'COUVERTURE VIDE : ' + tuiles + ' vignettes (attendu 40) , la page restera violette');
  process.exit(ok ? 0 : 1);
} catch (e) { console.log('ÉCHEC DE CHARGEMENT :', e.name, '·', String(e.message).slice(0, 120)); process.exit(1); }
