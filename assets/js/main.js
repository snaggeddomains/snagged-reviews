/* SnaggedReviews.com — progressive enhancement: review filtering + screenshot lightbox.
   All review content is present in the HTML; JS only filters and zooms. */
(function () {
  "use strict";

  /* ----- filter chips ----- */
  var chips = document.querySelectorAll(".chip");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));

  function applyFilter(value) {
    cards.forEach(function (card) {
      var show = value === "all" || card.getAttribute("data-source") === value;
      card.classList.toggle("is-hidden", !show);
    });
    chips.forEach(function (chip) {
      chip.setAttribute("aria-pressed", String(chip.getAttribute("data-filter") === value));
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      applyFilter(chip.getAttribute("data-filter"));
    });
  });

  /* ----- lightbox for original screenshots ----- */
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector(".lb__img img");
    var lbCap = lb.querySelector(".lb__cap");
    var lastFocus = null;

    function openLB(src, caption, link) {
      lastFocus = document.activeElement;
      lbImg.src = src;
      lbImg.alt = caption ? "Original screenshot: " + caption : "Original review screenshot";
      if (link) {
        lbCap.innerHTML = caption + ' &middot; <a href="' + link + '" target="_blank" rel="noopener">view on X &#8599;</a>';
      } else {
        lbCap.textContent = caption || "";
      }
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
      lb.querySelector(".lb__close").focus();
    }

    function closeLB() {
      lb.classList.remove("is-open");
      lbImg.src = "";
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-shot]");
      if (trigger) {
        e.preventDefault();
        openLB(trigger.getAttribute("data-shot"), trigger.getAttribute("data-name") || "", trigger.getAttribute("data-link") || "");
        return;
      }
      if (e.target.closest(".lb__close") || e.target === lb) closeLB();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lb.classList.contains("is-open")) closeLB();
    });
  }
})();
