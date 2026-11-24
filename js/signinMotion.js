/* Anchor Board sign-in pages (home.html, login.html): the headline arrives a letter at a time,
   the same way the public home page's headline does (site/story.js). Screen readers get the plain words.
   Skipped for reduced motion and data saver: the headline is just there. The rest of the motion is CSS (css/signin.css). */
(function () {
    var h = document.querySelector(".si h1");
    if (!h || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    if (navigator.connection && navigator.connection.saveData) return;
    var text = h.textContent.replace(/\s+/g, " ").trim(), i = 0;
    h.setAttribute("aria-label", text);
    h.textContent = "";
    text.split(" ").forEach(function (word, n) {
        if (n) h.appendChild(document.createTextNode(" "));
        var w = document.createElement("span");
        w.style.whiteSpace = "nowrap";
        w.setAttribute("aria-hidden", "true");
        for (var k = 0; k < word.length; k++) {
            var c = document.createElement("span");
            c.className = "si-ch"; c.style.setProperty("--i", i++); c.textContent = word[k];
            w.appendChild(c);
        }
        h.appendChild(w);
    });
})();
