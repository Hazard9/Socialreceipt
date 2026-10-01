/* Social Receipt app language. UI locale is separate from message analysis language.
   Stored locally only; message and draft text are never sent for translation. */
(function () {
  "use strict";
  var KEY = "sr_app_language";
  var translations = {
    "Stop rereading.": "Deja de releer.",
    "Know the move": "Ten claro qué hacer",
    "before you send it.": "antes de enviarlo.",
    "You are about to send something that costs you the interaction. Or say nothing when one sentence would have changed everything. Social Receipt reads the actual signals and tells you exactly what to do before you blow it.": "Estás a punto de enviar algo que puede perjudicar la conversación. O quizá no decir nada cuando una frase podría cambiarlo todo. Social Receipt analiza las señales y te ayuda a decidir qué hacer antes de enviar.",
    "For anyone about to send a text, DM, email, or caption they are not sure about — before a date, at work, with a client, or with a friend.": "Para quien no está seguro de enviar un mensaje, DM, correo o publicación, ya sea en una cita, en el trabajo, con un cliente o con una amistad.",
    "Example Social Receipt": "Ejemplo de Social Receipt",
    "The strongest move may be to wait.": "La mejor decisión quizá sea esperar.",
    "1": "1",
    "Paste the message, or what they said.": "Pega el mensaje o lo que te dijeron.",
    "Get your receipt: the risk, the hidden signal, what not to do.": "Obtén el análisis: el riesgo, la señal implícita y qué conviene evitar.",
    "Send the move that keeps your position, not the one you almost sent.": "Envía una respuesta que cuide tu postura, no la que casi enviaste.",
    "Start Free. Try Now.": "Empieza gratis. Pruébalo ahora.",
    "Home": "Inicio",
    "New": "Nuevo",
    "Pre-Send": "Antes de enviar",
    "History": "Historial",
    "Insights": "Análisis",
    "Replay": "Repaso",
    "Know the move before you send it.": "Ten claro qué hacer antes de enviar.",
    "Free": "Gratis",
    "Free reads used": "Análisis gratuitos usados",
    "You have ": "Te quedan ",
    " read": " análisis",
    " left. After this, ": ". Después, ",
    "you are guessing": "tendrás que decidir a ciegas",
    "Upgrade": "Mejorar plan",
    "Today's clarity": "La claridad de hoy",
    "receipts logged": "análisis guardados",
    "Log your first interaction to find the signal underneath the noise.": "Registra tu primera interacción para encontrar la señal entre tanto ruido.",
    "Create Receipt": "Crear análisis",
    "About to send": "A punto de enviar",
    "Received something": "Recibiste un mensaje",
    "What are you about to send?": "¿Qué estás a punto de enviar?",
    "Your progress": "Tu progreso",
    "Weekly reflection": "Reflexión semanal",
    "Your week has not started yet.": "Tu semana aún no ha comenzado.",
    "Before You Send": "Antes de enviar",
    "Paste the message. Get the risk check first.": "Pega el mensaje. Revisa el riesgo antes de enviarlo.",
    "Cold Read": "Lectura neutral",
    "Paste any conversation. See who has leverage.": "Pega una conversación para analizar la dinámica.",
    "After It Happened": "Después de lo ocurrido",
    "What happened?": "¿Qué pasó?",
    "Check Message": "Revisar mensaje",
    "Check another message": "Revisar otro mensaje",
    "Checking your message…": "Revisando tu mensaje…",
    "Paste the message you are about to send.": "Pega el mensaje que estás por enviar.",
    "Copy Rewrite": "Copiar versión",
    "Check Again": "Revisar de nuevo",
    "Check another message": "Revisar otro mensaje",
    "LOW. Clean to send.": "BAJO. Puedes enviarlo.",
    "MEDIUM. Needs a rewrite.": "MEDIO. Conviene reescribirlo.",
    "HIGH. Do not send this version.": "ALTO. No envíes esta versión.",
    "No clear pattern detected.": "No se detectó un patrón claro.",
    "Most people ruin the interaction before they realize it changed.": "Muchas personas perjudican la conversación antes de darse cuenta de que algo cambió.",
    "Not because they said the wrong thing. Because they sent one message too many, at the wrong moment, from the wrong state of mind.": "No por decir algo incorrecto, sino por enviar un mensaje de más, en el momento inoportuno o desde un estado emocional difícil.",
    "One sentence shifts the power dynamic. Usually the one you almost sent.": "Una frase puede cambiar la dinámica. A menudo, justo la que casi enviaste.",
    "The app does not tell you what to feel. It tells you what the signals actually say. Then it tells you the exact move.": "La aplicación no te dice qué sentir. Te ayuda a leer las señales y decidir qué hacer.",
    "You usually feel it after it is too late.": "A menudo lo notas cuando ya es demasiado tarde.",
    "That is what this stops. Paste what happened. Or paste what you are about to send. Know the move before it costs you.": "Esto ayuda a evitarlo. Pega lo que ocurrió o lo que estás por enviar y decide qué hacer antes de que te perjudique.",
    "Next": "Siguiente",
    "Get started": "Comenzar",
    "Continue": "Continuar",
    "Cancel": "Cancelar",
    "Close": "Cerrar",
    "Save": "Guardar",
    "Settings": "Configuración",
    "English": "Inglés",
    "Español": "Español",
    "Choose your language": "Elige tu idioma",
    "You can change this anytime. Your messages stay on this device.": "Puedes cambiarlo cuando quieras. Tus mensajes permanecen en este dispositivo.",
    "App language": "Idioma de la aplicación",
    "Message language": "Idioma del mensaje",
    "Auto-detect": "Detectar automáticamente",
    "Spanish": "Español",
    "French": "Francés",
    "Language": "Idioma"
  };
  var reverse = {};
  Object.keys(translations).forEach(function (en) { reverse[translations[en]] = en; });
  function get() {
    var value = "";
    try { value = localStorage.getItem(KEY) || ""; } catch (e) {}
    return value === "es" ? "es" : value === "en" ? "en" : "";
  }
  function shouldSkip(node) {
    var el = node.parentElement;
    if (!el) return true;
    if (el.closest("script,style,textarea,input,select,option,[contenteditable='true'],[data-user-content],#receiptOutput,#historyList,#insightsScreen,#presendText")) return true;
    return false;
  }
  function translateNode(node, lang) {
    if (!node || node.nodeType !== 3 || shouldSkip(node)) return;
    var value = node.nodeValue;
    var trimmed = value.trim();
    if (!trimmed) return;
    var target = lang === "es" ? translations[trimmed] : reverse[trimmed];
    if (!target || target === trimmed) return;
    var start = value.indexOf(trimmed);
    node.nodeValue = value.slice(0, start) + target + value.slice(start + trimmed.length);
  }
  function apply(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-sr-app-language]").forEach(function (el) {
      el.textContent = lang === "es" ? "ES" : "EN";
      el.setAttribute("aria-label", lang === "es" ? "Idioma de la aplicación: Español" : "App language: English");
      el.title = lang === "es" ? "Cambiar idioma" : "Change language";
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) { translateNode(node, lang); });
  }
  function choose(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    var chooser = document.getElementById("srLanguageChooser");
    if (chooser) chooser.remove();
    apply(lang);
  }
  function showChooser(firstRun) {
    if (document.getElementById("srLanguageChooser")) return;
    var overlay = document.createElement("div");
    overlay.id = "srLanguageChooser";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "srLanguageTitle");
    overlay.innerHTML = '<div class="sr-language-card"><p class="sr-language-brand">SOCIAL RECEIPT</p><h2 id="srLanguageTitle">Choose your language</h2><p class="sr-language-note">You can change this anytime. Your messages stay on this device.</p><button type="button" data-lang="en">English</button><button type="button" data-lang="es">Español</button></div>';
    var style = document.createElement("style");
    style.id = "srLanguageStyles";
    style.textContent = '#srLanguageChooser{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.82);display:grid;place-items:center;padding:20px;font-family:system-ui,-apple-system,sans-serif;color:#f2ece0}#srLanguageChooser .sr-language-card{width:min(100%,420px);background:#171512;border:1px solid rgba(212,170,90,.4);border-radius:20px;padding:26px;box-shadow:0 20px 70px #000}#srLanguageChooser .sr-language-brand{font-size:11px;letter-spacing:.16em;color:#d9b75c;margin:0 0 14px}#srLanguageChooser h2{font-size:26px;margin:0 0 10px;color:#f2ece0}#srLanguageChooser .sr-language-note{color:#b9ad9e;line-height:1.5;margin:0 0 20px}#srLanguageChooser button{display:block;width:100%;margin-top:10px;padding:14px;border:1px solid #51432b;border-radius:12px;background:#211d18;color:#f2ece0;font:600 16px system-ui;cursor:pointer}#srLanguageChooser button:focus{outline:2px solid #d9b75c}[data-sr-app-language]{position:fixed;z-index:1000;top:12px;right:12px;border:1px solid rgba(212,170,90,.5);border-radius:999px;background:#171512;color:#f2ece0;padding:7px 10px;font:600 12px system-ui;cursor:pointer;box-shadow:0 3px 14px #0008}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-lang]");
      if (button) choose(button.getAttribute("data-lang"));
    });
    if (!firstRun) {
      var selected = get() || "en";
      overlay.querySelector('[data-lang="' + selected + '"]').focus();
    }
  }
  function init() {
    var lang = get();
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-sr-app-language", "");
    toggle.addEventListener("click", function () { showChooser(false); });
    document.body.appendChild(toggle);
    if (lang) apply(lang);
    else showChooser(true);
    var observer = new MutationObserver(function (records) {
      var current = get() || "en";
      records.forEach(function (record) {
        if (record.type === "characterData") translateNode(record.target, current);
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 3) translateNode(node, current);
          else if (node.nodeType === 1) {
            var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            var nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(function (textNode) { translateNode(textNode, current); });
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.SRLanguage = { get: get, set: choose, apply: apply };
}());