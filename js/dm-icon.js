(function () {
  const ICON_PATH = "images/digimon-icon.png";
  const ICON_SRCSET =
    "images/digimon-icon-32.png 32w, images/digimon-icon-64.png 64w, images/digimon-icon.png 128w, images/digimon-icon-256.png 256w";

  function icon(extraClass = "") {
    const cls = extraClass ? `dm-icon ${extraClass}` : "dm-icon";
    return `<img class="${cls}" src="${ICON_PATH}" srcset="${ICON_SRCSET}" sizes="1em" alt="" aria-hidden="true" decoding="async" draggable="false">`;
  }

  function lightIcon() {
    return icon("dm-icon--light");
  }

  function withText(text, extraClass = "") {
    return `<span class="dm-with-icon">${icon(extraClass)}<span>${text}</span></span>`;
  }

  function amountDm(formattedAmount) {
    return `<span class="dm-with-icon dm-amount-line"><span class="dm-amount">${formattedAmount}</span>${icon()}<span>DM</span></span>`;
  }

  function setBalance(el, formattedAmount) {
    if (!el) return;
    el.innerHTML = amountDm(formattedAmount);
  }

  function setText(el, text, extraClass = "") {
    if (!el) return;
    el.innerHTML = withText(text, extraClass);
  }

  window.DmIcon = {
    icon,
    lightIcon,
    svg: icon,
    withText,
    amountDm,
    setBalance,
    setText
  };
})();
