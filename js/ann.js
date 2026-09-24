import { dbErrMsg, fmtWhen, requireDb, saveConfig, toast } from "./backend.js";
import { state } from "./state.js";
import { svgIcon } from "./text.js";

/* =========================================================
   5. Rendering, Announcements
   ========================================================= */
function renderGlobalBanner(){
  var b = state.globalBanner;
  var banner = document.getElementById("globalBanner");
  var dismissBtn = document.getElementById("gbDismissBtn");
  if (b && b.active && (b.text || b.title)){
    banner.hidden = false;
    document.getElementById("gbTitle").textContent = b.title || "Notice";
    document.getElementById("gbText").textContent = b.text || "";
    dismissBtn.hidden = !state.adminMode;
  } else {
    banner.hidden = true;
  }
  document.getElementById("gbTitleInput").value = (b && b.title) || "";
  document.getElementById("gbTextInput").value = (b && b.text) || "";
}

function saveGlobalBanner(active){
  saveConfig({
    globalBanner: {
      title: document.getElementById("gbTitleInput").value.trim(),
      text: document.getElementById("gbTextInput").value.trim(),
      active: active,
      updatedAt: new Date().toISOString()
    }
  }, active ? "Banner is live for everyone." : "Banner cleared.");
}

function renderAnnouncements(){
  var list = document.getElementById("announceList");
  var feedStatus = document.getElementById("feedStatus");
  if (state.dbReady) feedStatus.textContent = "";
  list.innerHTML = "";
  if (!state.announcements.length){
    list.innerHTML = '<div class="empty">No announcements yet.</div>';
    return;
  }
  state.announcements.forEach(function(a){
    var item = document.createElement("div");
    item.className = "announce-item" + (a.pinned ? " pinned" : "");
    var del = state.adminMode ? '<button class="announce-del" data-id="'+a.id+'">Remove</button>' : "";
    item.innerHTML =
      '<div class="announce-meta">'+(a.pinned?'<span class="pin">'+svgIcon("i-pin")+' Pinned</span>':'')+'<span>'+fmtWhen(a.createdAt)+'</span></div>'+
      '<div class="announce-text"></div>'+del;
    item.querySelector(".announce-text").textContent = a.text || "";
    list.appendChild(item);
  });
  list.querySelectorAll(".announce-del").forEach(function(btn){
    btn.addEventListener("click", function(){
      var db = requireDb(); if (!db) return;
      db.collection("announcements").doc(btn.getAttribute("data-id")).delete()
        .then(function(){ toast("Announcement removed."); })
        .catch(function(err){ toast(dbErrMsg(err), true); });
    });
  });
}

function postAnnouncement(){
  var db = requireDb(); if (!db) return;
  var text = document.getElementById("announceInput").value.trim();
  if (!text){ toast("Write something first.", true); return; }
  var pinned = document.getElementById("announcePin").checked;
  db.collection("announcements").add({
    text: text, pinned: pinned, createdAt: new Date().toISOString()
  }).then(function(){
    document.getElementById("announceInput").value = "";
    document.getElementById("announcePin").checked = false;
    toast("Posted to the class feed.");
  }).catch(function(err){ toast(dbErrMsg(err), true); });
}


export { postAnnouncement, renderAnnouncements, renderGlobalBanner, saveGlobalBanner };
