/**
 * 가로(landscape)일 때 body를 90° 회전 — 세로 UI 그대로 (모든 기기)
 */
(function (global) {
  function isLandscapeViewport() {
    return global.innerWidth > global.innerHeight;
  }

  function landscapeTransform() {
    const angle = global.screen?.orientation?.angle ?? global.orientation ?? 0;
    if (angle === 90 || angle === -270) {
      return { deg: "-90deg", tx: "-100%", ty: "0" };
    }
    if (angle === -90 || angle === 270) {
      return { deg: "90deg", tx: "0", ty: "-100%" };
    }
    return { deg: "-90deg", tx: "-100%", ty: "0" };
  }

  function updatePortraitForceLayout() {
    const root = global.document.documentElement;
    const body = global.document.body;
    if (!body) return;

    const active = isLandscapeViewport();
    root.classList.toggle("portrait-force-active", active);
    body.classList.toggle("portrait-force-active", active);

    if (!active) {
      root.style.removeProperty("--portrait-force-w");
      root.style.removeProperty("--portrait-force-h");
      root.style.removeProperty("--portrait-force-deg");
      root.style.removeProperty("--portrait-force-tx");
      root.style.removeProperty("--portrait-force-ty");
      return;
    }

    const w = global.innerHeight;
    const h = global.innerWidth;
    const t = landscapeTransform();
    root.style.setProperty("--portrait-force-w", `${w}px`);
    root.style.setProperty("--portrait-force-h", `${h}px`);
    root.style.setProperty("--portrait-force-deg", t.deg);
    root.style.setProperty("--portrait-force-tx", t.tx);
    root.style.setProperty("--portrait-force-ty", t.ty);
  }

  let bound = false;

  function bindPortraitForce() {
    if (bound) return;
    bound = true;
    updatePortraitForceLayout();
    global.addEventListener("orientationchange", updatePortraitForceLayout);
    global.addEventListener("resize", updatePortraitForceLayout);
    if (global.visualViewport) {
      global.visualViewport.addEventListener("resize", updatePortraitForceLayout);
    }
    if (global.screen?.orientation) {
      global.screen.orientation.addEventListener("change", updatePortraitForceLayout);
    }
  }

  global.PortraitForce = {
    update: updatePortraitForceLayout,
    bind: bindPortraitForce,
    isLandscape: isLandscapeViewport
  };

  updatePortraitForceLayout();
  bindPortraitForce();
})();
