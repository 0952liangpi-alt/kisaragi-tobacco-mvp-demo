(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const cartKey = 'kisaragi-shop-demo-cart-v1';
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const logistics = () => globalThis.KISARAGI_LOGISTICS;
  const paymentLabels = {card:'クレジットカード（希望）', konbini:'コンビニ払い（希望）', bank:'銀行振込（希望）', cod:'代金引換（希望）'};
  let items = [];
  let lastFocus = null;

  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const subtotalState = () => ({
    knownSubtotal:items.reduce((sum, item) => sum + Number(currentPrice(item) ?? 0), 0),
    hasUnknownPrice:items.some((item) => currentPrice(item) === null)
  });
  const amountWithUnknown = (amount, hasUnknownPrice) => hasUnknownPrice ? `${yen(amount)} + 価格未登録` : yen(amount);

  function restore() {
    try {
      const ids = JSON.parse(localStorage.getItem(cartKey) || '[]');
      items = ids.map((id) => catalog().find((item) => item.id === id)).filter(Boolean);
    } catch {
      items = [];
    }
  }

  function selectedMethodId() {
    return $('[name="shippingMethod"]:checked')?.value || logistics().shippingMethods[0].id;
  }

  function currentQuote() {
    const subtotal = subtotalState();
    return logistics().calculateQuote({methodId:selectedMethodId(), subtotal:subtotal.knownSubtotal, hasUnknownPrice:subtotal.hasUnknownPrice});
  }

  function renderSummary() {
    const host = $('#selectionItems');
    const subtotal = subtotalState();
    host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = '選択リストに商品がありません。商品案内から追加してください。';
      host.append(empty);
    } else {
      items.forEach((item) => {
        const line = document.createElement('article');
        line.className = 'selection-line';
        const name = item.product_name_ja || item.name || '商品名未登録';
        const code = item.product_code || item.sku || '品番未登録';
        const price = currentPrice(item);
        line.innerHTML = `<p><b>${escapeHtml(name)}</b></p><small>${escapeHtml(code)}</small><strong>${price === null ? '価格未登録' : yen(price)}</strong>`;
        host.append(line);
      });
    }
    $('#selectionTotal').textContent = amountWithUnknown(subtotal.knownSubtotal, subtotal.hasUnknownPrice);
    updateQuote();
  }

  function renderShippingMethods() {
    const host = $('#shippingMethods');
    logistics().shippingMethods.forEach((method, index) => {
      const label = document.createElement('label');
      label.className = 'shipping-card';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'shippingMethod';
      input.value = method.id;
      input.checked = index === 0;
      const copy = document.createElement('span');
      copy.className = 'shipping-copy';
      const title = document.createElement('b');
      title.textContent = method.name;
      const note = document.createElement('small');
      note.textContent = `${method.leadTime}目安 / ${method.integration} 契約後に有効化`;
      const price = document.createElement('strong');
      price.textContent = `${yen(method.fee)}（仮）`;
      copy.append(title, note);
      label.append(input, copy, price);
      host.append(label);
    });
    host.addEventListener('change', updateQuote);
  }

  function renderDeliveryPreferences() {
    const dateSelect = $('#deliveryDate');
    const earliest = document.createElement('option');
    earliest.value = '';
    earliest.textContent = '指定なし（最短希望）';
    dateSelect.append(earliest);
    logistics().getAvailableDeliveryDates().forEach((date) => {
      const option = document.createElement('option');
      option.value = date.value;
      option.textContent = `${date.label}（希望）`;
      dateSelect.append(option);
    });
    logistics().timeSlots.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot.id;
      option.textContent = slot.label;
      $('#deliveryTime').append(option);
    });
  }

  function renderIntegrationStatus() {
    const host = $('#integrationStatus');
    logistics().integrations.forEach((integration) => {
      const row = document.createElement('p');
      const name = document.createElement('span');
      const status = document.createElement('b');
      name.textContent = integration.name;
      status.textContent = integration.status === 'NOT_CONNECTED' ? '未接続' : integration.status;
      row.append(name, status);
      host.append(row);
    });
  }

  function updateQuote() {
    if (!logistics() || !$('#shippingTotal')) return;
    const quote = currentQuote();
    $('#shippingTotal').textContent = `${yen(quote.shippingFee)}（仮）`;
    $('#estimatedGrandTotal').textContent = amountWithUnknown(quote.knownGrandTotal, quote.hasUnknownPrice);
  }

  function clearError() {
    document.querySelectorAll('.error').forEach((node) => node.remove());
  }

  function error(message) {
    const node = document.createElement('p');
    node.className = 'error';
    node.textContent = message;
    $('#applicationForm').append(node);
    node.scrollIntoView({block:'nearest'});
  }

  function preview(event) {
    event.preventDefault();
    clearError();
    if (!items.length) {
      error('先に商品案内から商品を選択してください。');
      return;
    }
    const data = new FormData(event.currentTarget);
    const nameKana = String(data.get('nameKana') || '').trim();
    const email = String(data.get('email') || '').trim();
    if (!nameKana || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error('フリガナとテスト用メールアドレスを正しい形式で入力してください。');
      return;
    }
    if (!data.get('adultConsent')) {
      error('20歳以上であることと、実運用時に本人・年齢確認が必要であることを確認してください。');
      return;
    }
    const address = {
      recipientName:data.get('nameKanji'),
      phone:data.get('phone'),
      postalCode:data.get('postalCode'),
      prefecture:data.get('prefecture'),
      addressLine:data.get('addressLine')
    };
    const validation = logistics().validateAddress(address);
    if (!validation.valid) {
      error(validation.message);
      return;
    }
    const quote = currentQuote();
    const method = quote.method;
    const building = String(data.get('building') || '').trim();
    const deliveryDate = String(data.get('deliveryDate') || '指定なし（最短希望）');
    const slot = logistics().timeSlots.find((entry) => entry.id === data.get('deliveryTime')) || logistics().timeSlots[0];
    const fullAddress = `〒${address.postalCode} ${address.prefecture}${address.addressLine}${building ? ` ${building}` : ''}`;
    const details = [
      ['氏名', address.recipientName],
      ['フリガナ', data.get('nameKana')],
      ['配送先', fullAddress],
      ['配送会社候補', `${method.name} / ${yen(method.fee)}（仮）`],
      ['お届け希望', `${deliveryDate} / ${slot.label}`],
      ['支払い希望', paymentLabels[data.get('payment')]],
      ['概算合計', amountWithUnknown(quote.knownGrandTotal, quote.hasUnknownPrice)]
    ];
    $('#confirmationBody').innerHTML = `<div class="confirmation-list">${details.map(([label, value]) => `<p><b>${escapeHtml(label)}</b><br>${escapeHtml(value)}</p>`).join('')}</div>`;
    lastFocus = document.activeElement;
    $('#confirmation').hidden = false;
    $('#closeConfirmation').focus();
  }

  function closeConfirmation() {
    $('#confirmation').hidden = true;
    lastFocus?.focus();
  }

  function fillAddress() {
    clearError();
    const code = $('[name="postalCode"]').value.replace(/[^0-9]/g, '');
    if (code === '1000001') {
      $('[name="prefecture"]').value = '東京都';
      $('[name="addressLine"]').value = '千代田区千代田';
      return;
    }
    if (code === '1500001') {
      $('[name="prefecture"]').value = '東京都';
      $('[name="addressLine"]').value = '渋谷区神宮前';
      return;
    }
    error('例示の住所補完です。テスト用郵便番号 100-0001 または 150-0001 で確認できます。');
  }

  function checkTrackingConnection(event) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('trackingNumber') || '').trim();
    $('#trackingStatus').textContent = value
      ? '物流APIは未接続です。入力された番号の配送状況は取得・保存していません。'
      : 'テスト番号を入力しても、現在は物流API未接続のため照会されません。';
  }

  function init() {
    if (!logistics()) {
      console.error('KISARAGI logistics configuration failed to load');
      return;
    }
    restore();
    renderShippingMethods();
    renderDeliveryPreferences();
    renderIntegrationStatus();
    renderSummary();
    $('#applicationForm').addEventListener('submit', preview);
    $('#fillAddress').addEventListener('click', fillAddress);
    $('#trackingForm').addEventListener('submit', checkTrackingConnection);
    $('#closeConfirmation').addEventListener('click', closeConfirmation);
    $('#confirmation').addEventListener('click', (event) => { if (event.target === $('#confirmation')) closeConfirmation(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#confirmation').hidden) closeConfirmation(); });
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
