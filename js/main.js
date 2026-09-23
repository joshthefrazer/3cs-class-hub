import { boot } from "./orbit.js";
import { startIntro, replayIntro } from "./intro.js";
import { registerCommands } from "./palette.js";
import { toggleTheme } from "./theme.js";

function start(){
  /* The intro goes first so it is on screen while everything else loads
     behind it. */
  try{ startIntro(); }catch(e){ document.documentElement.classList.remove("intro-on"); }
  boot();
  var rb = document.getElementById("replayIntroBtn");
  if (rb) rb.addEventListener("click", function(){ window.scrollTo(0, 0); replayIntro(); });
  registerCommands(function(){
    return [
      { kind:"Do", title:"Replay the intro", hint:"the opening animation", run:replayIntro },
      { kind:"Do", title:"Switch light / dark mode", hint:"theme", run:toggleTheme }
    ];
  });
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
