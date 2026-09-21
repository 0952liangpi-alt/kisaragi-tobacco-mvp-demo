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

  function init() {
    if (!commerce()) {
      console.error('KISARAGI commerce configuration failed to load');
      return;
    }
    render();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
