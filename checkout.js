(() => {
  const $ = (selector) => document.querySelector(selector);
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;

  function restoreSelection() {
    return commerce().readCart()
      .map((line) => ({item:catalog().find((item) => item.id === line.id), quantity:line.quantity}))
      .filter((line) => line.item);
  }

  function render() {
    const items = restoreSelection();
    const host = $('#selectionItems');
    host.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const title = document.createElement('b');
      title.textContent = '選択された商品はありません。';
      const copy = document.createElement('p');
      copy.textContent = '商品案内から気になる商品を追加してください。';
      empty.append(title, copy);
      host.append(empty);
      $('#selectionTotal').textContent = '¥0';
      return;
    }

    let knownSubtotal = 0;
    let hasUnknownPrice = false;
    items.forEach(({item, quantity}) => {
      const price = currentPrice(item);
      if (price == null) hasUnknownPrice = true;
      else knownSubtotal += Number(price) * quantity;

      const line = document.createElement('article');
      line.className = 'selection-line';
      const copy = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = item.product_name_ja || item.name || '商品名未登録';
      const code = document.createElement('small');
      code.textContent = `${item.product_code || item.sku || '品番未登録'} / 数量 ${quantity}`;
      const total = document.createElement('strong');
      total.textContent = price == null ? '価格未登録' : `${yen(Number(price) * quantity)}${quantity === 1 ? '' : `（${yen(price)} × ${quantity}）`}`;
      copy.append(name, code);
      line.append(copy, total);
      host.append(line);
    });

    $('#selectionTotal').textContent = hasUnknownPrice
      ? `${knownSubtotal ? `確認済み分 ${yen(knownSubtotal)} + ` : ''}価格未登録`
      : yen(knownSubtotal);
  }

  function enhanceOrderModules() {
    const compact = window.matchMedia('(max-width: 760px)').matches;
    document.querySelectorAll('.function-module').forEach((module, index) => {
      const heading = module.querySelector('h3');
      const top = module.querySelector('.module-top');
      if (!heading || !top) return;

      const content = document.createElement('div');
      content.className = 'module-content';
      content.id = `${module.id}-content`;
      let sibling = heading.nextSibling;
      while (sibling) {
        const next = sibling.nextSibling;
        content.append(sibling);
        sibling = next;
      }
      module.append(content);

      const disclosure = document.createElement('button');
      disclosure.type = 'button';
      disclosure.className = 'module-disclosure';
      disclosure.setAttribute('aria-controls', content.id);
      const setExpanded = (expanded) => {
        module.classList.toggle('is-collapsed', !expanded);
        disclosure.setAttribute('aria-expanded', String(expanded));
        disclosure.textContent = expanded ? '閉じる' : '詳細';
      };
      disclosure.addEventListener('click', () => setExpanded(disclosure.getAttribute('aria-expanded') !== 'true'));
      top.append(disclosure);
      setExpanded(!compact || index === 0);
    });

    const revealHashTarget = () => {
      const target = location.hash && document.querySelector(location.hash);
      if (!target?.classList.contains('function-module')) return;
      const disclosure = target.querySelector('.module-disclosure');
      target.classList.remove('is-collapsed');
      disclosure?.setAttribute('aria-expanded', 'true');
      if (disclosure) disclosure.textContent = '閉じる';
    };
    document.querySelector('.function-rail')?.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const target = document.querySelector(link.getAttribute('href'));
      if (!target?.classList.contains('function-module')) return;
      target.classList.remove('is-collapsed');
      const disclosure = target.querySelector('.module-disclosure');
      disclosure?.setAttribute('aria-expanded', 'true');
      if (disclosure) disclosure.textContent = '閉じる';
    });
    revealHashTarget();
    window.addEventListener('hashchange', revealHashTarget);
  }

  function init() {
    if (!commerce()) {
      console.error('KISARAGI commerce configuration failed to load');
      return;
    }
    render();
    enhanceOrderModules();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
