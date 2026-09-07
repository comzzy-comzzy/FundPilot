(() => {
  const slides = [...document.querySelectorAll(".device")];
  const dots = [...document.querySelectorAll(".dots button")];
  const stage = document.getElementById("stage");
  const prev = document.querySelector(".slide-nav.prev");
  const next = document.querySelector(".slide-nav.next");
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

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function play() {
    stop();
    timer = setInterval(() => layout(index + 1), 5200);
  }

  prev?.addEventListener("click", () => {
    layout(index - 1);
    play();
  });
  next?.addEventListener("click", () => {
    layout(index + 1);
    play();
  });
  dots.forEach((d) =>
    d.addEventListener("click", () => {
      layout(Number(d.dataset.to));
      play();
    })
  );

  stage?.addEventListener("mouseenter", stop);
  stage?.addEventListener("mouseleave", play);
  window.addEventListener("resize", () => layout(index));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      layout(index - 1);
      play();
    }
    if (e.key === "ArrowRight") {
      layout(index + 1);
      play();
    }
  });

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

  /* Demo operator — Connect Binance */
  const connectBtn = document.getElementById("connect-btn");
  const statusEl = document.getElementById("connect-status");
  const desk = document.getElementById("op-desk");
  const queueItems = [
    { tag: "Approve", warn: false, label: "Contractor payment", amount: "$650.00" },
    { tag: "Review", warn: true, label: "Unusual transfer", amount: "$420.00" },
    { tag: "Due", warn: false, label: "Would break reserve", amount: "$1,200.00" },
  ];

  function setConnected(on) {
    if (!desk || !connectBtn || !statusEl) return;
    desk.dataset.connected = on ? "true" : "false";

    const bal = document.getElementById("desk-balance");
    const avail = document.getElementById("desk-avail");
    const locked = document.getElementById("desk-locked");
    const change = document.getElementById("desk-change");
    const pill = document.getElementById("desk-pill");
    const count = document.getElementById("queue-count");
    const list = document.getElementById("desk-items");

    if (on) {
      connectBtn.classList.add("is-connected");
      connectBtn.innerHTML = "Connected · demo";
      statusEl.textContent = "Demo mode — mock balances. Live auth runs via baw locally.";
      statusEl.classList.add("is-ok");
      if (bal) bal.textContent = "$12,450.23";
      if (avail) avail.textContent = "$11,210.23";
      if (locked) locked.textContent = "$1,240.00";
      if (change) change.textContent = "+2.4% 24h";
      if (pill) {
        pill.textContent = "Demo";
        pill.classList.add("live");
      }
      if (count) count.textContent = String(queueItems.length);
      if (list) {
        list.innerHTML = queueItems
          .map(
            (q) =>
              `<li><span><span class="tag${q.warn ? " warn" : ""}">${q.tag}</span>${q.label}</span><strong>${q.amount}</strong></li>`
          )
          .join("");
      }
    } else {
      connectBtn.classList.remove("is-connected");
      connectBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l3.09 3.09-1.41 1.41L12 4.83 4.83 12l7.17 7.17 1.41-1.41L16.09 21 12 22l-10-10L12 2zm4.59 6.17L18 6.76 22 10.76l-1.41 1.41-4-4zm-1.17 1.17L12 12.76l3.42 3.42 1.41-1.41L14.83 12l1.59-1.66z"/></svg> Connect Binance';
      statusEl.textContent = "Not connected — click to simulate.";
      statusEl.classList.remove("is-ok");
      if (bal) bal.textContent = "—";
      if (avail) avail.textContent = "—";
      if (locked) locked.textContent = "—";
      if (change) change.textContent = "—";
      if (pill) {
        pill.textContent = "Offline";
        pill.classList.remove("live");
      }
      if (count) count.textContent = "0";
      if (list) list.innerHTML = '<li class="empty">Connect to load the desk.</li>';
    }
  }

  connectBtn?.addEventListener("click", () => {
    const on = desk?.dataset.connected !== "true";
    connectBtn.disabled = true;
    if (on) {
      statusEl.textContent = "Connecting to Binance (demo)…";
      statusEl.classList.remove("is-ok");
      setTimeout(() => {
        setConnected(true);
        connectBtn.disabled = false;
      }, 650);
    } else {
      setConnected(false);
      connectBtn.disabled = false;
    }
  });

  
  document.querySelectorAll(".decision-card[data-to-slide]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.toSlide);
      if (!Number.isNaN(i)) { layout(i); play(); }
      document.getElementById("stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  layout(0);
  if (!new URLSearchParams(location.search).has("static")) play();
})();
