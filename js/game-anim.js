(function () {
  function gsap() {
    return window.gsap;
  }

  function toPromise(target, vars) {
    const g = gsap();
    if (!g) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      g.to(target, { ...vars, onComplete: resolve });
    });
  }

  function fromPromise(target, vars) {
    const g = gsap();
    if (!g) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      g.from(target, { ...vars, onComplete: resolve });
    });
  }

  function timelineDone(tl) {
    const g = gsap();
    if (!g || !tl) return Promise.resolve();
    return new Promise((resolve) => {
      tl.eventCallback("onComplete", resolve);
    });
  }

  function killTarget(target) {
    gsap()?.killTweensOf(target);
  }

  window.GameAnim = {
    gsap,
    toPromise,
    fromPromise,
    timelineDone,
    killTarget,
    ease: {
      move: "power2.out",
      bounce: "back.out(1.4)",
      snap: "power2.inOut"
    }
  };
})();
