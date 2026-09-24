import { BE, signIn, signOutNow, toast, usingFirebase } from "./backend.js";

/* =========================================================
   SIGNING IN, Google, or an email and a password.

   Google is the nicer route when it works: the name and photo come with it
   and there is no password to forget. But a school Google Workspace can
   block outside apps from using "Continue with Google" at all, and when that
   happens there is nothing the app can do about it from this side.

   So there is a second door. An email-and-password account is created in
   Firebase Auth and is entirely separate from the school's Google account
   that happens to share the address - it just needs an inbox you can reach,
   for the reset link.

   The password never touches this code: it goes from the field straight into
   the Firebase SDK, which sends it to Google's servers over TLS. Nothing here
   stores it, logs it, or writes it anywhere.
   ========================================================= */

var mode = "in";        // "in" | "up" | "reset"
var busy = false;

function sheet(){ return document.getElementById("authSheet"); }
function el(id){ return document.getElementById(id); }

function openAuthSheet(){
  if (!usingFirebase()){ toast("Sign-in isn't available in this view.", true); return; }
  mode = "in";
  paint();
  sheet().hidden = false;
  setTimeout(function(){ var e = el("authEmail"); if (e) e.focus(); }, 60);
}
function closeAuthSheet(){
  var s = sheet();
  if (s) s.hidden = true;
  setErr("");
}

function setErr(msg){
  var e = el("authErr");
  if (!e) return;
  e.textContent = msg || "";
  e.className = "status-line" + (msg ? " err" : "");
}
function setNote(msg){
  var e = el("authNote");
  if (!e) return;
  e.textContent = msg || "";
  e.hidden = !msg;
}

function paint(){
  var title = el("authSheetTitle");
  var sub   = el("authSheetSub");
  var name  = el("authNameField");
  var pw    = el("authPassField");
  var go    = el("authGoBtn");
  var swap  = el("authSwapBtn");
  var forgot= el("authForgotBtn");
  if (!title) return;

  setErr(""); setNote("");

  if (mode === "in"){
    title.textContent = "Sign in";
    sub.textContent = "Use your school email, or continue with Google if your account allows it.";
    name.hidden = true;
    pw.hidden = false;
    go.textContent = "Sign in";
    swap.textContent = "New here? Create an account";
    forgot.hidden = false;
  } else if (mode === "up"){
    title.textContent = "Create an account";
    sub.textContent = "Your name is what the class sees on anything you post.";
    name.hidden = false;
    pw.hidden = false;
    go.textContent = "Create account";
    swap.textContent = "Already have one? Sign in";
    forgot.hidden = true;
  } else {
    title.textContent = "Reset your password";
    sub.textContent = "We'll email you a link to set a new one.";
    name.hidden = true;
    pw.hidden = true;
    go.textContent = "Send the link";
    swap.textContent = "Back to signing in";
    forgot.hidden = true;
  }
}

function swap(){
  mode = mode === "in" ? "up" : "in";
  paint();
}
function forgot(){
  mode = "reset";
  paint();
}

/* Firebase's codes are precise but unreadable. These are the same facts in
   the words a person would use. */
function authErrMsg(err){
  var c = (err && err.code) || "";
  if (c === "auth/invalid-email")            return "That doesn't look like an email address.";
  if (c === "auth/missing-password")         return "Type your password too.";
  if (c === "auth/weak-password")            return "That password is too short. Use at least six characters.";
  if (c === "auth/email-already-in-use")     return "There's already an account on that email. Sign in instead, or reset the password.";
  if (c === "auth/invalid-credential" ||
      c === "auth/wrong-password" ||
      c === "auth/user-not-found")           return "That email and password don't match an account.";
  if (c === "auth/too-many-requests")        return "Too many tries. Wait a few minutes and go again.";
  if (c === "auth/network-request-failed")   return "Couldn't reach the server. Check your connection.";
  if (c === "auth/operation-not-allowed")    return "Email sign-in isn't switched on for this Hub yet.";
  if (c === "auth/user-disabled")            return "That account has been disabled.";
  return (err && err.message) ? err.message.replace(/^Firebase:\s*/, "") : "Couldn't sign in.";
}

function lock(on, label){
  busy = on;
  var go = el("authGoBtn");
  if (go){ go.disabled = on; if (label) go.textContent = label; }
}

function submit(){
  if (busy) return;
  var email = (el("authEmail").value || "").trim();
  var pass  = el("authPassword") ? el("authPassword").value : "";
  var name  = el("authName") ? (el("authName").value || "").trim() : "";

  if (!email){ setErr("Type your email address."); return; }

  if (mode === "reset"){
    lock(true, "Sending…");
    BE.auth.sendPasswordResetEmail(email)
      .then(function(){
        lock(false, "Send the link");
        setNote("Sent. Check that inbox. The link works once.");
        setErr("");
      })
      .catch(function(err){ lock(false, "Send the link"); setErr(authErrMsg(err)); });
    return;
  }

  if (!pass){ setErr("Type your password."); return; }

  if (mode === "up"){
    if (!name){ setErr("Put in the name the class should see."); return; }
    lock(true, "Creating…");
    BE.auth.createUserWithEmailAndPassword(email, pass)
      .then(function(cred){
        /* Without this every post would be signed with an email address. */
        return cred.user.updateProfile({ displayName: name }).then(function(){
          /* The account existed a moment before it had a name, so put the
             name everywhere the class will see it now. */
          if (BE.user && BE.user.id === cred.user.uid) BE.user.name = name;
          var saveProfile = BE.db.doc("profiles/" + cred.user.uid).set({ name: name.slice(0, 40), photo: "", updatedAt: new Date().toISOString() })
            .catch(function(){});
          return saveProfile.then(function(){
            return import("./people.js").then(function(m){ return m.touchDirectory(true); });
          }).then(function(){ import("./backend.js").then(function(m){ m.paintAuth(); }); });
        }).then(function(){
          /* Best effort - a bounced verification email should not stop anyone
             using the Hub, it only matters if we later restrict by domain. */
          return cred.user.sendEmailVerification().catch(function(){});
        });
      })
      .then(function(){
        closeAuthSheet();
        toast("Welcome in, " + name + ".");
      })
      .catch(function(err){ lock(false, "Create account"); setErr(authErrMsg(err)); });
    return;
  }

  lock(true, "Signing in…");
  BE.auth.signInWithEmailAndPassword(email, pass)
    .then(function(){ closeAuthSheet(); })
    .catch(function(err){ lock(false, "Sign in"); setErr(authErrMsg(err)); });
}

function wireAuthSheet(){
  var s = sheet();
  if (!s) return;
  s.addEventListener("click", function(e){ if (e.target === s) closeAuthSheet(); });
  el("authSheetClose").addEventListener("click", closeAuthSheet);
  el("authGoogleBtn").addEventListener("click", function(){ closeAuthSheet(); signIn(); });
  el("authGoBtn").addEventListener("click", submit);
  el("authSwapBtn").addEventListener("click", function(){
    if (mode === "reset") mode = "in"; else swap();
    paint();
  });
  el("authForgotBtn").addEventListener("click", forgot);
  ["authEmail","authPassword","authName"].forEach(function(id){
    var f = el(id);
    if (f) f.addEventListener("keydown", function(e){ if (e.key === "Enter") submit(); });
  });
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && s && !s.hidden) closeAuthSheet();
  });
}

export { openAuthSheet, closeAuthSheet, wireAuthSheet, authErrMsg };
