// Muestra aleatoria de productos populares: no representa ventas verificadas.
window.EUREKA_TOP_SELLERS = (() => {
  let selectedCodes = [];

  function shuffle(source) {
    const result = source.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function pick(products, desiredCount = 9) {
    const eligible = (Array.isArray(products) ? products : []).filter(
      (item) => item && item.active !== false && item.code
        && Number(item.price) > 0 && String(item.image || "").trim()
    );
    const available = new Map(eligible.map((item) => [item.code, item]));
    const count = Math.min(Math.max(0, Number(desiredCount) || 0), available.size);

    // Mantiene la misma selección durante la navegación del carrusel y los redibujados.
    if (selectedCodes.length === count && selectedCodes.every((code) => available.has(code))) {
      return selectedCodes.slice();
    }

    const groups = new Map();
    for (const item of eligible) {
      const category = String(item.categoryKey || item.categoryLabel || "catalogo");
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    }

    const selected = [];
    const chosen = new Set();
    for (const category of shuffle(Array.from(groups.keys()))) {
      if (selected.length >= count) break;
      const candidate = shuffle(groups.get(category))[0];
      if (!candidate || chosen.has(candidate.code)) continue;
      selected.push(candidate.code);
      chosen.add(candidate.code);
    }

    if (selected.length < count) {
      const remaining = shuffle(eligible.filter((item) => !chosen.has(item.code)));
      for (const candidate of remaining) {
        if (selected.length >= count) break;
        selected.push(candidate.code);
        chosen.add(candidate.code);
      }
    }

    selectedCodes = selected;
    return selectedCodes.slice();
  }

  return Object.freeze({ pick });
})();
