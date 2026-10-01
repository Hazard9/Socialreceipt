(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SocialReceiptAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Local phrase profiles describe wording in one draft, never a person's fixed identity.
  var EN = new Set("i me my you your we us our they them this that it is are was were be been have has had do does did can could would should will not no yes and or but to of for in on with if so just maybe please sorry the a an what why how when where who".split(" "));
  var ES = new Set("yo me mi tu te usted ustedes nosotros nos ellos ellas esto eso lo la los las es son era fue ser estar estoy estas esta estamos estan tener tengo tiene hay no si y o pero de del al para por en con que como cuando donde quien cual muy ya pues siempre haces mismo soy supongo sientas siento puede quieres nos vemos todo bien voy vas hacer dano arrepentir".split(" "));

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFKC")
      .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])[\u2018\u2019]([A-Za-zÀ-ÖØ-öø-ÿ])/g, "$1'$2").replace(/[\u0060]/g, "'").replace(/[–—]/g, "-")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }
  function detectLanguage(text, words) {
    if (/[\u0400-\u052f\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text))
      return { code: "unsupported", name: "Unrecognized language", supported: false };
    if (/\b(je suis|nous sommes|vous etes|desole|merci beaucoup|c'est|qu'est)\b/.test(text))
      return { code: "fr", name: "French", supported: false };
    var en = 0, es = 0;
    words.forEach(function (w) { if (EN.has(w)) en++; if (ES.has(w)) es++; });
    if (es >= 2 && es > en) return { code: "es", name: "Spanish", supported: true };
    if (en >= 1 && en >= es) return { code: "en", name: "English", supported: true };
    return { code: "unknown", name: "Unclear", supported: false };
  }
  function firstMatch(text, regexes) {
    for (var i = 0; i < regexes.length; i++) {
      regexes[i].lastIndex = 0;
      var match = text.match(regexes[i]);
      if (match) return match[0];
    }
    return "";
  }

  function contextNotesFor(context, found, en, quoteRemoved) {
    context = context || {};
    var notes = [];
    if (context.language === "en" || context.language === "es")
      notes.push(en
        ? "The English phrase pack was selected for this draft."
        : "Se seleccionó el repertorio de frases en español para este borrador.");
    var goal = context.goal || "";
    if (goal === "boundary") {
      notes.push(found.boundary
        ? (en ? "Your stated goal is a boundary, and this draft includes a direct-limit cue. Check that the limit says what you need." : "Tu objetivo es poner un límite y el borrador incluye una señal directa de límite. Comprueba que exprese lo que necesitas.")
        : (en ? "Your stated goal is a boundary. This draft has no common direct-limit phrase match; check whether the limit itself is clear." : "Tu objetivo es poner un límite. No se encontró una frase común de límite directo; comprueba si el límite está claro."));
    } else if (goal === "repair") {
      notes.push(found.apology || found.repair
        ? (en ? "Your stated goal is repair, and the draft includes an accountability or repair cue. Check that it matches what you mean to own." : "Tu objetivo es reparar la situación y el borrador incluye una señal de responsabilidad o reparación. Comprueba que refleje lo que quieres asumir.")
        : (en ? "Your stated goal is repair. No common accountability or repair phrase match appeared; consider whether you want to name your part or invite a conversation." : "Tu objetivo es reparar la situación. No apareció una frase común de responsabilidad o reparación; considera si quieres nombrar tu parte o invitar a conversar."));
    } else if (goal === "clarify") {
      notes.push(found.clarifier
        ? (en ? "Your stated goal is clarification, and the draft includes a clarifying cue." : "Tu objetivo es aclarar y el borrador incluye una señal aclaratoria.")
        : (en ? "Your stated goal is clarification. Check whether the main point or question is stated plainly." : "Tu objetivo es aclarar. Comprueba si la idea principal o la pregunta están expresadas claramente."));
    } else if (goal === "request") {
      notes.push(found.reassurance
        ? (en ? "Your stated goal is to ask for reassurance or a response. This wording may also feel pressuring depending on timing and context." : "Tu objetivo es pedir tranquilidad o una respuesta. La frase también podría sentirse insistente según el momento y el contexto.")
        : (en ? "Your stated goal is to make a request. Check that the specific thing you want is easy to identify." : "Tu objetivo es hacer una petición. Comprueba que se entienda qué necesitas concretamente."));
    } else if (goal === "decline") {
      notes.push(found.boundary
        ? (en ? "Your stated goal is to decline, and the draft includes a direct-limit cue." : "Tu objetivo es rechazar y el borrador incluye una señal directa de límite.")
        : (en ? "Your stated goal is to decline. Check whether your answer is direct enough to avoid leaving the decision unclear." : "Tu objetivo es rechazar. Comprueba si tu respuesta es lo bastante directa para evitar ambigüedad."));
    } else if (goal === "close") {
      notes.push(found.withdrawal
        ? (en ? "Your stated goal is to pause or close the conversation. A closing phrase can be a valid limit; alongside reluctant agreement it may sound punitive." : "Tu objetivo es pausar o cerrar la conversación. Una frase de cierre puede ser un límite válido; junto con un acuerdo resignado podría sonar punitiva.")
        : (en ? "Your stated goal is to pause or close the conversation. Check whether you say what happens next, such as when you may be ready to continue." : "Tu objetivo es pausar o cerrar la conversación. Comprueba si indicas qué ocurrirá después, por ejemplo cuándo podrías continuar."));
    }

    if (context.situation === "after_conflict" && signalsHaveConcern(found))
      notes.push(en
        ? "You marked this as following a disagreement. That context can change how these wording cues land; it still cannot establish intent."
        : "Marcaste que esto ocurre después de un desacuerdo. Ese contexto puede cambiar cómo se reciben estas frases, pero no demuestra intención.");
    if (context.situation === "routine" && signalsHaveConcern(found))
      notes.push(en
        ? "You marked this as routine communication. The flagged wording may have a different meaning in your shared context."
        : "Marcaste que es una conversación cotidiana. Las frases señaladas pueden tener otro sentido en el contexto que comparten.");
    if (context.quoted === true)
      notes.push(quoteRemoved
        ? (en ? "Words inside detected quote marks were excluded from wording signals. They may still affect how the complete message lands." : "Las palabras entre comillas detectadas se excluyeron de las señales. Aun así, pueden influir en cómo se recibe el mensaje completo.")
        : (en ? "You marked quoted wording, but no quoted span was separated. If the quoted words are not inside quotation marks, they may still be included in the signals." : "Marcaste palabras citadas, pero no se pudo separar un fragmento entre comillas. Si no están entre comillas, aún podrían incluirse en las señales."));
    return notes;
  }

  function signalsHaveConcern(found) {
    return Object.keys(found).some(function (key) {
      return found[key] && ["deflective", "selfBlame", "reluctant", "sarcasm", "guilt", "withdrawal", "blame", "reassurance", "minimizing", "resentment", "resignation", "frustration", "deferential", "defensiveProof", "repetition", "intentAttribution", "insult", "threat"].indexOf(key) >= 0;
    });
  }


  function looksFrench(text) {
    var frenchText = text.replace(new RegExp(String.fromCharCode(39), "g"), " ");
    return /\b(?:je suis desole|desolee|merci beaucoup|comme tu veux|si tu le dis|comme d habitude|ne t inquiete pas|je m en doutais|quelle surprise|j en ai marre|ca me fatigue|je ne veux plus parler|je ne peux pas|je ne suis pas disponible|j ai besoin d espace|pas de souci|tu vas le regretter|je vais te frapper|je vais te tuer)\b/.test(frenchText);
  }
  function analyzeFrench(text, context) {
    var scan = text;
    var quoted = false;
    if (context && context.quoted === true) {
      scan = text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g, " ");
      quoted = scan !== text;
    }
    scan = scan.replace(new RegExp(String.fromCharCode(39), "g"), " ");
    var groups = {
      deflective: [/\bje suis desole que tu te sentes\b/, /\bdesole que tu te sentes\b/],
      blameShift: [/\bsuppose que je suis toujours le probleme\b/, /\bje suis toujours le probleme\b/],
      reluctant: [/\bcomme tu veux\b/, /\bsi tu le dis\b/, /\bc est toi qui vois\b/, /\bd accord si tu veux\b/],
      resentment: [/\bcomme d habitude\b/, /\bquelle surprise\b/, /\bje m en doutais\b/, /\bpas etonnant\b/, /\bapparemment\b/, /\bmerci pour rien\b/],
      softener: [/\bc est pas grave\b/, /\bce n est pas grave\b/, /\bne t inquiete pas pour moi\b/, /\bpas de souci\b/],
      frustration: [/\bj en ai marre\b/, /\bca me fatigue\b/, /\bca commence a bien faire\b/, /\bje suis fatigue de\b/, /\bje suis fatiguee de\b/],
      guilt: [/\bapres tout ce que j ai fait\b/, /\bsi tu tenais a moi\b/, /\bje m en souviendrai\b/],
      withdrawal: [/\bje ne veux plus parler\b/, /\blaisse tomber\b/, /\bc est fini entre nous\b/, /\bne me parle plus\b/],
      boundary: [/\bje ne peux pas\b/, /\bje ne suis pas disponible\b/, /\bj ai besoin d espace\b/, /\bmerci de ne pas\b/, /\bca ne me convient pas\b/],
      repair: [/\bje veux reparer\b/, /\bon peut en parler\b/, /\bcomment peut on arranger\b/, /\bje veux comprendre\b/],
      apology: [/\bc etait ma faute\b/, /\bje reconnais que j ai\b/, /\bje suis desole d avoir\b/],
      threat: [/\bje vais te faire payer\b/, /\btu vas le regretter\b/, /\bje vais te frapper\b/, /\bje vais te tuer\b/],
      insult: [/\btais toi\b/, /\bje te deteste\b/, /\btu es un idiot\b/, /\btu es stupide\b/]
    };
    var found = {};
    var evidence = {};
    Object.keys(groups).forEach(function (key) {
      evidence[key] = "";
      for (var i = 0; i < groups[key].length; i++) {
        var m = scan.match(groups[key][i]);
        if (m) { evidence[key] = m[0]; break; }
      }
      found[key] = !!evidence[key];
    });
    var signals = [];
    function add(id, label, detail, kind, keys) {
      var matches = (keys || []).map(function (key) { return evidence[key]; }).filter(Boolean);
      signals.push({ id: id, label: label, detail: detail, kind: kind, evidence: matches.slice(0, 3) });
    }
    if (found.deflective) add("deflective-apology", "Excuse qui peut détourner le sujet", "Cette formule porte sur le ressenti de l'autre plutôt que sur l'action de la personne qui écrit. Le contexte compte.", "concern", ["deflective"]);
    if (found.blameShift) add("self-blame-shift", "Autocritique qui peut déplacer l'attention", "Cela peut exprimer une vraie blessure ou inviter l'autre à rassurer. La phrase seule ne permet pas de trancher.", "concern", ["blameShift"]);
    if (found.softener && found.resentment) add("polite-resentment", "Formule apaisante avec un reproche", "La formule atténuante apparaît avec un reproche ou du ressentiment; l'ensemble peut sembler passif-agressif. Le contexte peut changer cette lecture.", "concern", ["softener", "resentment"]);
    if ((found.softener || found.reluctant) && found.frustration) add("softener-frustration", "Atténuation avec frustration", "Une formule conciliante apparaît près d'une frustration explicite. Cela peut sembler indirect ou simplement exprimer de la retenue.", "concern", ["softener", "reluctant", "frustration"]);
    if (found.reluctant) add("reluctant-agreement", "Accord possiblement résigné", "Cette formule peut exprimer un désaccord retenu, mais elle peut aussi être sincère selon votre habitude de parler.", "context", ["reluctant"]);
    if (found.guilt) add("guilt-pressure", "Possible pression par la culpabilité", "La phrase peut rendre l'autre responsable du bien-être ou des efforts passés de la personne qui écrit.", "concern", ["guilt"]);
    if (found.withdrawal) add("conversation-close", "Formule de retrait ou de clôture", "Mettre fin à une conversation peut être une limite valable. Le ton dépend de ce qui l'entoure.", "context", ["withdrawal"]);
    if (found.boundary) add("boundary-setting", "Limite exprimée", "Une limite n'est pas automatiquement hostile ou risquée.", "positive", ["boundary"]);
    if (found.apology) add("accountability-apology", "Indice de responsabilité", "La phrase nomme une action de la personne qui écrit; une réparation précise peut clarifier l'excuse.", "positive", ["apology"]);
    if (found.repair) add("repair-attempt", "Volonté de réparer", "La phrase propose de comprendre ou de résoudre le problème.", "positive", ["repair"]);
    if (found.threat) add("threat", "Menace ou contrainte possible", "Cette phrase contient une menace directe. Le signal décrit les mots, pas la personne.", "high", ["threat"]);
    if (found.insult) add("insult", "Insulte directe", "La phrase attaque l'autre plutôt que de décrire le problème.", "concern", ["insult"]);
    var high = signals.some(function (s) { return s.kind === "high"; });
    var concerns = signals.some(function (s) { return s.kind === "concern"; });
    var positive = signals.some(function (s) { return s.kind === "positive"; });
    var level = high ? "high" : concerns ? "medium" : positive ? "low" : "uncertain";
    var levels = {
      high: ["ÉLEVÉ. Formulation menaçante détectée.", "Relisez attentivement cette phrase. Ce signal décrit le texte, pas le caractère ou l'intention de la personne."],
      medium: ["MOYEN. Possible pression dans le ton.", "Une formulation peut sembler défensive, méprisante, accusatrice ou insistante. Le contexte peut changer cette lecture."],
      low: ["FAIBLE. Aucun indice courant de pression détecté.", "Le texte contient une limite, une responsabilité ou une volonté de réparation. Cela ne garantit pas comment il sera reçu."],
      uncertain: ["INCERTAIN. Le contexte peut changer la lecture.", "Cette bibliothèque locale n'a pas repéré de motif fort. Cela ne prouve pas que le message soit neutre."]
    };
    var notes = [];
    if (context && context.goal === "boundary") notes.push("Votre objectif indiqué est de poser une limite. Vérifiez que la limite exprime clairement ce dont vous avez besoin.");
    if (context && context.goal === "repair") notes.push("Votre objectif indiqué est de réparer la situation. Vérifiez que la phrase dit ce que vous souhaitez reconnaître ou résoudre.");
    if (context && context.situation === "after_conflict" && signals.length) notes.push("Vous indiquez que le message suit un désaccord. Ce contexte peut changer la façon dont les mots sont reçus; il ne prouve pas une intention.");
    if (context && context.situation === "routine" && signals.length) notes.push("Vous indiquez qu'il s'agit d'un échange habituel. Votre contexte partagé peut donner un autre sens aux formulations signalées.");
    if (context && context.quoted) notes.push(quoted ? "Les mots entre guillemets détectés ont été exclus des indices attribués à la personne qui écrit." : "Les mots cités n'ont pas pu être isolés; les guillemets sont nécessaires pour les exclure.");
    return {
      supported: true, language: "fr", languageName: "Français", level: level,
      label: levels[level][0], summary: levels[level][1], signals: signals,
      styleHints: [], contextNotes: notes,
      note: "Ces indices décrivent les mots d'un brouillon, pas un diagnostic ou un profil fixe. L'intention, l'histoire, la culture et le point de vue de l'autre peuvent changer la lecture."
    };
  }

  function analyze(value, context) {
    var text = normalize(value);
    if (!text) return { supported: false, language: "unknown", languageName: "Unclear", level: "uncertain",
      label: "UNCLEAR. Add a message to check.", summary: "Paste the wording you want to review.", signals: [], styleHints: [], contextNotes: [],
      note: "This reads wording in the draft. It cannot know intent or the full conversation." };

    if (context && context.language === "fr" || looksFrench(text)) return analyzeFrench(text, context || {});

    var words = text.split(/[^a-z0-9']+/).filter(Boolean);
    var scanText = text;
    var quoteRemoved = false;
    if (context && context.quoted === true) {
      scanText = text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g, " ");
      quoteRemoved = scanText !== text;
    }
    var lang = context && (context.language === "en" || context.language === "es")
      ? { code: context.language, name: context.language === "es" ? "Spanish" : "English", supported: true }
      : detectLanguage(text, words);
    if (!lang.supported) return { supported: false, language: lang.code, languageName: lang.name, level: "uncertain",
      label: "UNCLEAR. More context is needed.", summary: "This local phrase library currently checks English and Spanish patterns. It cannot reliably read this language or assign a clean-to-send result.",
      signals: [], styleHints: [], contextNotes: [], note: "No green or red verdict is assigned when language coverage is uncertain." };

    var en = lang.code === "en";
    var P = en ? {
      deflective: [/\bi'?m sorry (?:that )?you (?:feel|think|believe)\b/, /\bsorry (?:that )?you (?:feel|think|believe)\b/, /\bi apologize that you\b/],
      selfBlame: [/\bi guess i'?m (?:always )?(?:the problem|the bad guy|wrong)\b/, /\bi'?m always the problem\b/, /\bi guess i'?m just a terrible person\b/],
      reluctant: [/\bwhatever you want\b/, /\bif that'?s what you want\b/, /\bfine[,! ]+whatever\b/, /\bsure[,! ]+i guess\b/, /\bi guess that'?s fine\b/, /\bdo whatever you want\b/],
      sarcasm: [/\bthanks for nothing\b/, /\bmust be nice\b/, /\bglad you finally\b/, /\bwhat a surprise\b/],
      guilt: [/\bif you cared\b/, /\bafter all i'?ve done\b/, /\bdon'?t worry about me\b/, /\bi guess i'?ll just\b/, /\bi'?ll remember that\b/],
      withdrawal: [/\bi'?m done talking\b/, /\bi don'?t want to talk to you\b/, /\bforget it\b/, /\bdon'?t bother\b/, /\bwe'?re done\b/],
      minimizing: [/\bno worries\b/, /\bno problem\b/, /\ball good\b/, /\b(?:it's|it is) fine\b/, /\bnot a big deal\b/, /\bdon't worry about it\b/],
      resentment: [/\bapparently\b/, /\bif you say so\b/, /\bshould have known\b/, /\bshould've known\b/, /\bas usual\b/, /\bnot surprised\b/],
      resignation: [/\bi guess i'll do it myself\b/, /\bi guess (?:i am|i'm) on my own\b/],
      frustration: [/\bi'?m (?:honestly )?tired of this\b/, /\bso tired of this\b/, /\bthis is getting old\b/, /\bthis is frustrating\b/, /\bnot fair\b/],
      deferential: [/\btake your time\b/, /\bwhenever (?:works|you can|you get a chance)\b/, /\bi know you'?re busy\b/, /\bprobably busy\b/],
      defensiveProof: [/\bi already (?:told|said|explained) you\b/, /\bi did tell you\b/, /\bi'?ve explained this\b/, /\bi told you already\b/],
      repetition: [/\bhow many times\b/, /\bfor the (?:second|third|fourth) time\b/, /\bagain\b/],
      intentAttribution: [/\byou'?re trying to\b/, /\byou are trying to\b/, /\byou just want to\b/, /\byou want me to\b/],
      blame: [/\byou always\b/, /\byou never\b/, /\byou made me\b/, /\byou don'?t care\b/],
      reassurance: [/\bare we okay\b/, /\bdo you still care\b/, /\bare you mad at me\b/, /\bplease tell me (?:we'?re|you'?re)\b/, /\bdid i do something wrong\b/],
      boundary: [/\bi can'?t make it\b/, /\bi cannot make it\b/, /\bi'?m not available\b/, /\bthat doesn'?t work for me\b/, /\bplease don'?t\b/, /\bplease stop\b/, /\bi need some space\b/],
      apology: [/\bi'?m sorry i\b/, /\bi apologize for\b/, /\bthat was my fault\b/, /\bi was wrong to\b/],
      clarifier: [/\bto be clear\b/, /\bfor context\b/, /\bwhat i mean is\b/, /\bcan you clarify\b/],
      repair: [/\bi want to fix this\b/, /\bcan we talk this through\b/, /\bcan we figure this out\b/],
      threat: [/\byou'?ll regret it\b/, /\bi'?ll make you pay\b/, /\bi will hurt you\b/, /\bi'?m going to hurt you\b/, /\bi'?ll hurt you\b/, /\bif you don'?t .{0,35} i'?ll\b/],
      insult: [/\byou are (?:a )?(?:worthless|stupid|an idiot)\b/, /\bshut up\b/, /\bi hate you\b/],
      warmth: [/\bi love you\b/, /\blove you\b/, /\bglad you'?re (?:on your way )?home\b/, /\bxoxo\b/, /\bmiss you\b/],
      careOffer: [/\byou can have\b/, /\bhelp yourself\b/, /\bi saved some for you\b/, /\bthere'?s some for you\b/, /\bi made you\b/, /\bwant some\b/]
    } : {
      deflective: [/\blo siento (?:que )?te sientas asi\b/, /\bsiento que te sientas asi\b/],
      selfBlame: [/\bsupongo que yo soy (?:siempre )?el problema\b/, /\bsupongo que yo siempre soy el problema\b/, /\bsupongo que siempre soy el problema\b/],
      reluctant: [/\blo que tu quieras\b/, /\bsi eso es lo que quieres\b/, /\besta bien[,! ]+lo que quieras\b/, /\bcomo quieras\b/],
      sarcasm: [/\bgracias por nada\b/, /\bque sorpresa\b/, /\bme alegro que por fin\b/, /\bdebe ser bonito\b/],
      guilt: [/\bdespues de todo lo que he hecho\b/, /\bno te preocupes por mi\b/, /\bsi te importara\b/],
      withdrawal: [/\bya no quiero hablar\b/, /\bno me hables\b/, /\bolvidalo\b/, /\bno importa\b/, /\bse acabo\b/],
      minimizing: [/\bno pasa nada\b/, /\bno hay problema\b/, /\besta bien\b/, /\bno importa\b/],
      resentment: [/\bcomo siempre\b/, /\bsi tu lo dices\b/, /\bya me lo imaginaba\b/, /\bno me sorprende\b/],
      resignation: [/\bme las arreglo solo\b/, /\bme las arreglo sola\b/],
      frustration: [/\bestoy harto de\b/, /\bestoy harta de\b/, /\bestoy cansado de\b/, /\bestoy cansada de\b/, /\bme canse de\b/, /\besto es injusto\b/, /\besto ya cansa\b/],
      deferential: [/\bcuando puedas\b/, /\bcuando tengas tiempo\b/, /\bse que estas ocupado\b/, /\bse que estas ocupada\b/],
      defensiveProof: [/\bya te dije\b/, /\bya te explique\b/, /\bte lo dije antes\b/],
      repetition: [/\bcuantas veces\b/, /\bpor tercera vez\b/, /\botra vez\b/],
      intentAttribution: [/\bestas tratando de\b/, /\bquieres que yo\b/, /\bsolo quieres\b/],
      blame: [/\bsiempre haces\b/, /\bnunca haces\b/, /\btu me hiciste\b/, /\bno te importa\b/],
      reassurance: [/\bestamos bien\b/, /\btodavia te importo\b/, /\bestas enojado conmigo\b/, /\bhice algo mal\b/],
      boundary: [/\bno puedo ir\b/, /\bno puedo asistir\b/, /\bno estoy disponible\b/, /\bno me funciona\b/, /\bpor favor no\b/, /\bnecesito espacio\b/],
      apology: [/\bperdon por lo que hice\b/, /\blo siento por\b/, /\bfue mi culpa\b/],
      clarifier: [/\bpara ser claro\b/, /\bpara dar contexto\b/, /\blo que quiero decir es\b/, /\bpuedes aclarar\b/],
      repair: [/\bquiero arreglar esto\b/, /\bpodemos hablarlo\b/, /\bpodemos resolverlo\b/],
      threat: [/\bte vas a arrepentir\b/, /\bte voy a hacer pagar\b/, /\bte voy a hacer dano\b/],
      insult: [/\beres un idiota\b/, /\beres estupido\b/, /\bcallate\b/, /\bte odio\b/],
      warmth: [/\bte quiero\b/, /\bte amo\b/, /\bme alegra que vuelvas a casa\b/, /\bme alegra que estes de camino a casa\b/, /\bte extrano\b/],
      careOffer: [/\bpuedes comer\b/, /\bpuedes tomar\b/, /\bte guarde\b/, /\bsirvete\b/, /\bquieres un poco\b/]
    };

    var found = {};
    var matches = {};
    Object.keys(P).forEach(function (k) {
      matches[k] = firstMatch(scanText, P[k]);
      found[k] = !!matches[k];
    });
    if (found.blame && /\b(?:not saying|not claiming|don't think|do not think|didn't say|did not say)\s+(?:that\s+)?you\s+(?:always|never)\b/.test(scanText))
      found.blame = false;
    var signals = [], hints = [];
    function add(id, label, detail, kind, hint) {
      if (signals.some(function (s) { return s.id === id; })) return;
      var evidenceMap = {
        "deflective-apology": ["deflective"], "self-blame-shift": ["selfBlame"],
        "reluctant-agreement": ["reluctant"], "sarcasm-dismissal": ["sarcasm"],
        "polite-resentment": ["minimizing", "resentment"], "softener-frustration": ["minimizing", "deferential", "frustration"],
        "reassurance-pressure": ["reassurance", "minimizing", "deferential", "guilt"],
        "defensive-proof": ["defensiveProof"], "repeated-explanation": ["repetition"],
        "intent-attribution": ["intentAttribution"], "guilt-pressure": ["guilt"],
        "conversation-close": ["withdrawal"], "absolute-blame": ["blame"],
        "reassurance-seeking": ["reassurance"], "boundary-setting": ["boundary"],
        "accountability-apology": ["apology"], "clarifier": ["clarifier"],
        "repair-attempt": ["repair"], "threat": ["threat"], "insult": ["insult"],
        "resigned-self-reliance": ["resignation"], "warmth-care": ["warmth", "careOffer"]
      };
      var evidence = (evidenceMap[id] || []).map(function (key) { return matches[key]; }).filter(Boolean).slice(0, 3);
      signals.push({ id: id, label: label, detail: detail, kind: kind || "concern", evidence: evidence });
      if (hint && hints.indexOf(hint) < 0) hints.push(hint);
    }
    if (found.deflective) add("deflective-apology", en ? "Apology may deflect" : "La disculpa puede desviar el tema", en ? "Focuses on how the recipient feels rather than naming the sender's action." : "Se enfoca en cómo se siente la otra persona, no en nombrar la acción propia.", "concern", "Conflict Resolver-style repair");
    if (found.selfBlame) add("self-blame-shift", en ? "Self-blame may shift the focus" : "La autoculpa puede cambiar el enfoque", en ? "May invite reassurance instead of addressing the original issue. It may also be sincere hurt; wording alone cannot establish intent." : "Puede invitar a tranquilizar a quien escribe en vez de abordar el problema. También puede expresar dolor sincero; el texto no prueba la intención.", "concern");
    if (found.resignation) add("resigned-self-reliance", en ? "Resigned self-reliance cue" : "Señal de resignación y autosuficiencia", en ? "May express frustration indirectly, though it can also be literal. Context matters." : "Puede expresar frustración indirectamente, aunque también puede ser literal. El contexto importa.", "concern");
    if (found.reluctant) add("reluctant-agreement", en ? "Reluctant agreement" : "Acuerdo posiblemente resignado", en ? "May read as concealed disagreement, especially beside an abrupt ending." : "Puede leerse como desacuerdo oculto, especialmente junto a un cierre abrupto.", "concern");
    if (found.sarcasm) add("sarcasm-dismissal", en ? "Sarcasm or dismissal cue" : "Señal de sarcasmo o desdén", en ? "Can sound sarcastic or dismissive depending on context." : "Puede sonar sarcástico o despectivo según el contexto.", "concern");
    if (found.minimizing && found.resentment) add("polite-resentment", en ? "Polite wording beside resentment" : "Cortesía junto a resentimiento", en ? "Softening language appears beside a dismissive or frustrated cue; the combination may read as passive-aggressive, but context matters." : "Una frase suavizante aparece junto a una señal despectiva o frustrada; la combinación puede leerse como pasivo-agresiva, pero depende del contexto.", "concern", "Clarifier-style explanation");
    if ((found.minimizing || found.deferential) && found.frustration) add("softener-frustration", en ? "Softening beside frustration" : "Atenuación junto a frustración", en ? "A softener or deferential phrase appears beside stated frustration; the combination may sound passive-aggressive, though it can also express genuine restraint." : "Una frase atenuante o deferente aparece junto a frustración explícita; la combinación puede sonar pasivo-agresiva, aunque también puede expresar moderación sincera.", "concern");
    if (found.reassurance && (found.minimizing || found.deferential || found.guilt)) add("reassurance-pressure", en ? "Reassurance request beside a softener" : "Petición de tranquilidad junto a una atenuación", en ? "The combination may soften a request while still asking the recipient to reassure you. Timing and context matter." : "La combinación puede suavizar una petición y aun así pedir tranquilidad a la otra persona. El momento y el contexto importan.", "concern");
    if (found.defensiveProof) add("defensive-proof", en ? "Defensive proof cue" : "Señal de defensa mediante pruebas", en ? "A phrase emphasizes that the point was already explained; this can be factual, but may sound defensive beside frustration." : "La frase enfatiza que ya se explicó el punto; puede ser factual, pero sonar defensiva junto a frustración.", found.frustration || found.repetition ? "concern" : "context");
    if (found.repetition) add("repeated-explanation", en ? "Repeated-explanation cue" : "Señal de explicación repetida", en ? "Words like 'again' or 'how many times' may signal repeated explanation; alone they do not establish pressure." : "Palabras como 'otra vez' o 'cuántas veces' pueden señalar una explicación repetida; por sí solas no prueban presión.", found.frustration || found.defensiveProof ? "concern" : "context");
    if (found.intentAttribution) add("intent-attribution", en ? "Intent-attribution cue" : "Señal de atribución de intención", en ? "This wording assigns a motive to the recipient. It may shift the exchange from what happened to why they did it." : "La frase atribuye un motivo a la otra persona. Puede desviar el intercambio de lo ocurrido hacia por qué lo hizo.", "concern");
    if (found.guilt) add("guilt-pressure", en ? "Possible guilt pressure" : "Posible presión mediante culpa", en ? "May make the recipient feel responsible for the sender's wellbeing or past effort." : "Puede hacer que la otra persona se sienta responsable del bienestar o los esfuerzos pasados de quien escribe.", "concern");
    if (found.withdrawal) add("conversation-close", en ? "Conversation-closing cue" : "Señal de cierre de conversación", en ? "Signals withdrawal. That can be a valid boundary; paired with reluctant agreement it may sound punitive." : "Señala distancia. Puede ser un límite válido; junto con un acuerdo resignado puede sonar punitivo.", found.reluctant ? "concern" : "context", "Boundary Protector-style limit");
    if (found.blame) add("absolute-blame", en ? "Absolute or blaming wording" : "Frase absoluta o acusatoria", en ? "Words like 'always' or 'never' can turn a specific concern into a character judgment." : "Palabras como 'siempre' o 'nunca' pueden convertir una preocupación concreta en un juicio personal.", "concern");
    if (found.reassurance) add("reassurance-seeking", en ? "Reassurance-seeking cue" : "Señal de búsqueda de tranquilidad", en ? "May read as vulnerable or as pressure, depending on timing and context." : "Puede leerse como vulnerabilidad o presión, según el momento y el contexto.", "context", "Reassurance Seeker-style request");
    if (found.boundary) add("boundary-setting", en ? "Clear boundary or limit" : "Límite claro", en ? "A limit is not automatically hostile or high-risk." : "Un límite no es automáticamente hostil ni de alto riesgo.", "positive", "Boundary Protector-style limit");
    if (found.apology) add("accountability-apology", en ? "Accountability cue" : "Señal de responsabilidad", en ? "Names the sender's own action. A specific repair can make the apology clearer." : "Nombra una acción propia. Una reparación concreta puede aclarar la disculpa.", "positive", "Conflict Resolver-style repair");
    if (found.clarifier) add("clarifier", en ? "Clarifying or context-setting cue" : "Señal para aclarar o dar contexto", en ? "Appears aimed at making meaning or context clearer." : "Parece buscar claridad en el significado o el contexto.", "positive", "Clarifier-style explanation");
    if (found.repair) add("repair-attempt", en ? "Repair-oriented cue" : "Señal de intención reparadora", en ? "Expresses interest in understanding or resolving the issue." : "Expresa interés en entender o resolver el problema.", "positive", "Conflict Resolver-style repair");
    if (found.warmth || found.careOffer) add("warmth-care", en ? "Warmth or care cue" : "Señal de afecto o atención", en ? "Affection, a welcome, or an offer of care appears in the draft. That can support a warm reading, but it cannot guarantee how the whole message will land." : "El borrador expresa afecto, bienvenida o una oferta de atención. Esto puede apoyar una lectura cálida, pero no garantiza cómo se recibirá el mensaje completo.", "positive");
    if (found.threat) add("threat", en ? "Threat or coercion cue" : "Señal de amenaza o coacción", en ? "Contains direct threat or coercive wording." : "Contiene lenguaje de amenaza directa o coacción.", "high");
    if (found.insult) add("insult", en ? "Direct insult" : "Insulto directo", en ? "Attacks the recipient rather than describing the issue." : "Ataca a la otra persona en vez de describir el problema.", "concern");
    if (words.length > 45) add("long-draft", en ? "Long draft" : "Borrador largo", en ? "Length alone is not a tone problem, but the main point may be hard to find." : "La longitud no es por sí sola un problema de tono, pero puede ocultar la idea principal.", "context", "Clarifier-style explanation");

    var concerns = signals.filter(function (s) { return s.kind === "concern"; }).length;
    var hasPositive = signals.some(function (s) { return s.kind === "positive"; });
    var isHigh = signals.some(function (s) { return s.kind === "high"; });
    var level, label, summary;
    if (isHigh) {
      level = "high"; label = en ? "HIGH. Threat or coercion wording detected." : "ALTO. Se detectó lenguaje de amenaza o coacción.";
      summary = en ? "Review this wording carefully. This flag describes the text, not the sender's character or intent." : "Revisa la frase con cuidado. La señal describe el texto, no el carácter ni la intención de quien escribe.";
    } else if (concerns) {
      level = "medium"; label = en ? "MEDIUM. Possible tone pressure detected." : "MEDIO. Posible presión en el tono.";
      summary = en ? "A wording pattern may land as defensive, dismissive, blaming, or pressuring. Context can change that reading." : "Un patrón puede sonar defensivo, despectivo, acusatorio o insistente. El contexto puede cambiar esa lectura.";
    } else if (hasPositive) {
      level = "low"; label = en ? "LOW. No common pressure cue detected." : "BAJO. No se detectó una señal común de presión.";
      summary = en ? "The wording includes warmth, care, a boundary, accountability, repair, or clarification. This is not a guarantee about how it will land." : "La frase expresa afecto, atención, un límite, responsabilidad, reparación o aclaración. Esto no garantiza cómo se recibirá.";
    } else {
      level = "uncertain"; label = en ? "UNCLEAR. More context may change the read." : "NO ESTÁ CLARO. Más contexto puede cambiar la lectura.";
      summary = en ? "No strong pattern from this local phrase library was detected. That does not prove the message is neutral or low-pressure." : "La biblioteca local no detectó un patrón claro. Eso no demuestra que el mensaje sea neutral o sin presión.";
    }
    var contextNotes = contextNotesFor(context, found, en, quoteRemoved);
    return {
      supported: true, language: lang.code, languageName: lang.name, level: level,
      label: label, summary: summary, signals: signals, styleHints: hints,
      contextNotes: contextNotes,
      note: en
        ? "These are wording cues in one draft, not a diagnosis or a fixed profile. Intent, history, culture, and the recipient's perspective can change the reading."
        : "Son señales en un borrador, no un diagnóstico ni un perfil fijo. La intención, la historia, la cultura y la perspectiva de quien recibe el mensaje pueden cambiar la interpretación."
    };
  }
  return { analyze: analyze, normalize: normalize, detectLanguage: detectLanguage };
});
