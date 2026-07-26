/**
 * Stock Picks — 일치율·수익률 통계 (개별 전략 페이지 공유)
 */
(function () {
  function computeMatchStats(signals) {
    let match = 0;
    let mismatch = 0;
    let pending = 0;
    for (const sig of signals || []) {
      const dm = sig.directionMatch;
      if (dm === "일치") match += 1;
      else if (dm === "불일치") mismatch += 1;
      else pending += 1;
    }
    const evaluated = match + mismatch;
    const ratePct = evaluated > 0 ? (match / evaluated) * 100 : null;
    return {
      match,
      mismatch,
      pending,
      total: (signals || []).length,
      evaluated,
      ratePct
    };
  }

  function signalHoldDayReturn(sig, day) {
    if (day === 1) {
      if (sig?.holdDay1ReturnPct != null && Number.isFinite(Number(sig.holdDay1ReturnPct))) {
        return Number(sig.holdDay1ReturnPct);
      }
      if (sig?.dayReturnPct != null && Number.isFinite(Number(sig.dayReturnPct))) {
        return Number(sig.dayReturnPct);
      }
      const sigClose = sig?.close;
      const nextClose = sig?.nextClose;
      if (sigClose != null && nextClose != null && Number(sigClose) !== 0) {
        return ((Number(nextClose) / Number(sigClose)) - 1) * 100;
      }
      return null;
    }
    const field = `holdDay${day}ReturnPct`;
    const v = sig?.[field];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  function computeReturnStats(signals) {
    const returns = (signals || [])
      .map((sig) => signalHoldDayReturn(sig, 1))
      .filter((v) => v != null && Number.isFinite(Number(v)))
      .map((v) => Number(v));
    const returnCount = returns.length;
    const returnSumPct = returnCount > 0 ? returns.reduce((sum, v) => sum + v, 0) : null;
    return {
      returnSumPct,
      returnCount,
      returnUp: returns.filter((r) => r > 0).length,
      returnDown: returns.filter((r) => r < 0).length
    };
  }

  function mergeStats(signals) {
    return { ...computeMatchStats(signals), ...computeReturnStats(signals) };
  }

  function formatMatchRate(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "—";
    return `${ratePct.toFixed(1)}%`;
  }

  function formatReturnSum(returnSumPct) {
    if (returnSumPct == null || !Number.isFinite(returnSumPct)) return "—";
    const sign = returnSumPct > 0 ? "+" : "";
    return `${sign}${returnSumPct.toFixed(1)}%`;
  }

  function rateClass(ratePct) {
    if (ratePct == null || !Number.isFinite(ratePct)) return "neutral";
    return ratePct >= 50 ? "up" : "down";
  }

  function returnSumClass(returnSumPct) {
    if (returnSumPct == null || !Number.isFinite(returnSumPct)) return "neutral";
    return returnSumPct > 0 ? "up" : returnSumPct < 0 ? "down" : "neutral";
  }

  window.StockMatchStats = {
    computeMatchStats,
    computeReturnStats,
    signalHoldDayReturn,
    mergeStats,
    formatMatchRate,
    formatReturnSum,
    rateClass,
    returnSumClass
  };
})();
