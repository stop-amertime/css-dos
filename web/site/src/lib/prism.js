// prism.js - the shared Prism instance. Bundled from npm (replaces
// the old jsdelivr <script> tags in index.html, so highlighting
// works offline and on the static host with no third-party fetch).
//
// The stock CSS grammar is extended with two tokens cabinet code is
// full of but vanilla CSS rarely shows: custom properties ANYWHERE
// (stock Prism only recognises them before a colon, missing var()
// arguments and @function parameters) and bare numbers. Both are
// inserted into @-rule preludes too, or `@function --f(--a)` would
// stay one flat token.
import Prism from 'prismjs/components/prism-core.js';
import 'prismjs/components/prism-css.js';

Prism.manual = true; // never auto-highlight on DOMContentLoaded

const variable = /--[\w-]+/;
// No trailing \b: digits glued to a unit (400ms) still count. No
// leading risk either - digits inside identifiers (--mc5000) are
// taken by the variable token first.
const number = /\b\d+(?:\.\d+)?/;
Prism.languages.insertBefore('css', 'property', { variable });
Prism.languages.insertBefore('css', 'function', { number });
Prism.languages.insertBefore('inside', 'rule', { variable, number },
  Prism.languages.css.atrule);

export default Prism;
