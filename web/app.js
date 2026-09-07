(() => {
  const slides = [...document.querySelectorAll(".device")];
  const dots = [...document.querySelectorAll(".dots button")];
  const stage = document.getElementById("stage");
  const prev = document.querySelector(".slide-nav.prev");
  const next = document.querySelector(".slide-nav.next");
  const modal = document.getElementById("demo-modal");
  const menuBtn = document.querySelector(".menu-toggle");
  const drawer = document.querySelector(".drawer");
  const n = slides.length;
  let index = 0;
  let timer = null;

  const isMobile = () => window.matchMedia("(max-width: 799px)").matches;

  function layout(i) {
    index = (i + n) % n;
    const mobile = isMobile();
    slides.forEach((el, s) => {
      let offset = s - index;
      if (offset > n / 2) offset -= n;
      if (offset < -n / 2) offset += n;
      const front = offset === 0;
      if (mobile) {
        el.style.transform = "translate(-50%, -50%)";
        el.style.opacity = front ? "1" : "0";
        el.style.filter = "none";
        el.style.zIndex = front ? "2" : "1";
      } else {
        const angle = offset * 42;
        const x = offset * 200;
        const z = front ? 60 : -240;
        const scale = front ? 1 : 0.86;
        el.style.transform = `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${angle}deg) scale(${scale})`;
        el.style.opacity = front ? "1" : "0.4";
        el.style.filter = front ? "none" : "blur(0.4px)";
        el.style.zIndex = front ? "3" : "1";
      }
      el.style.pointerEvents = front ? "auto" : "none";
      el.classList.toggle("is-active", front);
    });
    dots.forEach((d, s) => d.classList.toggle("is-on", s === index));
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    stop();
    timer = setInterval(() => layout(index + 1), 5200);
  }

  prev?.addEventListener("click", () => { layout(index - 1); play(); });
  next?.addEventListener("click", () => { layout(index + 1); play(); });
  dots.forEach((d) => d.addEventListener("click", () => { layout(Number(d.dataset.to)); play(); }));

  stage?.addEventListener("mouseenter", stop);
  stage?.addEventListener("mouseleave", play);
  window.addEventListener("resize", () => layout(index));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { layout(index - 1); play(); }
    if (e.key === "ArrowRight") { layout(index + 1); play(); }
    if (e.key === "Escape" && modal && !modal.hidden) modal.hidden = true;
  });

  document.querySelectorAll("[data-open-demo]").forEach((b) => {
    b.addEventListener("click", () => { if (modal) modal.hidden = false; });
  });
  document.querySelectorAll("[data-close-demo], .modal-close").forEach((b) => {
    b.addEventListener("click", () => { if (modal) modal.hidden = true; });
  });
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

  menuBtn?.addEventListener("click", () => {
    const open = drawer.hasAttribute("hidden");
    if (open) drawer.removeAttribute("hidden");
    else drawer.setAttribute("hidden", "");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      drawer.setAttribute("hidden", "");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  layout(0);
  if (!new URLSearchParams(location.search).has("static")) play();
})();
