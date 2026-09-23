/* =========================================================
   THEME — light by default, with a dark switch.

   With nothing chosen the Hub follows the device. Pressing the switch
   pins a choice in this browser; the inline script in <head> reads it
   back before first paint, so there's never a flash of the wrong one.
   ========================================================= */

var KEY = "3cs_theme";
var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function chosen(){
  try{ var t = localStorage.getItem(KEY); return t === "dark" || t === "light" ? t : null; }catch(e){ return null; }
}
function isDark(){
  var c = chosen();
  if (c) return c === "dark";
  return !!(media && media.matches);
}

function paintButton(){
  var b = document.getElementById("themeBtn");
  if (!b) return;
  var dark = isDark();
  b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  b.title = dark ? "Light mode" : "Dark mode";
}

function apply(mode){
  var d = document.documentElement;
  if (mode) d.setAttribute("data-theme", mode); else d.removeAttribute("data-theme");
  try{ if (mode) localStorage.setItem(KEY, mode); else localStorage.removeItem(KEY); }catch(e){}
  paintButton();
}

function toggleTheme(){
  var next = isDark() ? "light" : "dark";
  /* A circular wipe from the button when the browser can do it; an
     instant swap everywhere else. */
  var b = document.getElementById("themeBtn");
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && b && !reduced){
    var r = b.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add("theme-swap");
    var vt = document.startViewTransition(function(){ apply(next); });
    vt.ready.then(function(){
      document.documentElement.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] },
        { duration: 520, easing: "cubic-bezier(.3,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(function(){});
    vt.finished.finally(function(){ document.documentElement.classList.remove("theme-swap"); });
  } else {
    apply(next);
  }
}

function initTheme(){
  var b = document.getElementById("themeBtn");
  if (b) b.addEventListener("click", toggleTheme);
  if (media && media.addEventListener) media.addEventListener("change", paintButton);
  paintButton();
}

export { initTheme, toggleTheme, isDark };
