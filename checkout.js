(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const live = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const logistics = () => globalThis.KISARAGI_LOGISTICS;
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const catalogAuthorityConfigured = () => Boolean(globalThis.KISARAGI_LIVE_CONFIG?.apiBase);
  const catalogAuthorityReady = () => globalThis.KISARAGI_LIVE_STATUS === 'LIVE';
  const categoryLabels = {
    CIGARETTES:'紙巻きたばこ', IMPORTED_CIGARETTES:'輸入紙巻きたばこ', CIGARS:'葉巻たばこ',
    RYO:'手巻きたばこ', PIPE_TOBACCO:'パイプたばこ', CUT_TOBACCO:'刻みたばこ',
    HEATED_TOBACCO_STICKS:'加熱式たばこスティック', HEATED_TOBACCO_CAPSULES:'加熱式たばこカプセル',
    HEATED_TOBACCO_DEVICES:'加熱式たばこデバイス', SMOKELESS_TOBACCO:'無煙たばこ',
    SMOKING_ACCESSORIES:'喫煙用品', ROLLING_ACCESSORIES:'手巻き喫煙具', PIPE_ACCESSORIES:'パイプ用品',
    ASHTRAYS:'携帯灰皿', LIGHTERS:'ライター',
  };
  const customerProductName = (item) => {
    const raw = item.product_name_ja || item.name || '';
    const pending = item.status === 'IDENTITY_PENDING' || raw.includes('確認待ち');
    if (!pending && raw) return raw;
    return `${categoryLabels[item.category] || '商品'} ${item.product_code || item.sku || ''}`.trim();
  };
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const orderStatusLabel = (status) => ({
    DRAFT:'仮注文保存済み', PENDING:'処理中', PENDING_PROVIDER:'外部手続き待ち',
    AGE_VERIFICATION_PENDING:'年齢・本人確認待ち', AGE_VERIFIED:'年齢確認済み',
    AGE_VERIFICATION_FAILED:'年齢・本人確認未完了',
    AWAITING_PAYMENT:'お支払い待ち', PAYMENT_PENDING:'お支払い確認中', PAYMENT_FAILED:'お支払い未完了',
    PAYMENT_REVIEW_REQUIRED:'お支払い確認中', PAID:'お支払い済み', FULFILLMENT_PENDING:'出荷準備中',
    READY_TO_SHIP:'出荷準備完了', SHIPPED:'発送済み', IN_TRANSIT:'配送中', DELIVERED:'配達済み',
    CANCELLATION_IN_PROGRESS:'取消処理中', CANCELLED:'取消済み',
    REFUND_PENDING:'返金処理中', REFUND_IN_PROGRESS:'返金処理中', REFUNDED:'返金済み',
  })[String(status || '').toUpperCase()] || '確認中';
  const officialPriceKindLabel = (kind) => ({
    MANUFACTURER_LIST_PRICE_TAX_INCLUDED:'メーカー定価', MANUFACTURER_LIST_PRICE_TAX_INCLUSIVE:'メーカー定価',
    MANUFACTURER_LIST_PRICE:'メーカー定価', FIXED_LIST_PRICE:'定価', CATALOG_RETAIL_PRICE:'カタログ掲載小売価格',
    CATALOG_PRICE:'カタログ掲載価格', CATALOG_LISTED_PRICE:'カタログ掲載価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUDED:'希望小売価格', SUGGESTED_RETAIL_PRICE_TAX_INCLUSIVE:'希望小売価格',
    SUGGESTED_RETAIL_PRICE:'希望小売価格', OPEN_PRICE:'オープン価格',
  })[String(kind || '').toUpperCase()] || '公式カタログ価格';

  let liveCapabilities = null;
  let liveSession = {authenticated:false};
  let liveCartPayload = null;
  let liveCheckoutOptions = null;
  let liveRefreshGeneration = 0;
  let liveRefreshPromise = null;
  let identityRefreshPromise = null;

  function element(tag, {className, text, type} = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    if (type) node.type = type;
    return node;
  }

  function announce(node, message, error = false) {
    node.setAttribute('role', error ? 'alert' : 'status');
    node.setAttribute('aria-live', error ? 'assertive' : 'polite');
    node.setAttribute('aria-atomic', 'true');
    node.textContent = message;
  }

  function statusElement(className, message, error = false) {
    const node = element('div', {className});
    announce(node, message, error);
    return node;
  }

  function sessionIdentity(value) {
    if (value?.authenticated !== true) return 'anonymous';
    const id = value?.user?.id;
    return typeof id === 'string' && id ? `member:${id}` : null;
  }

  function clearSensitiveCheckoutView(message = '会員情報とカートを再確認しています。') {
    liveRefreshGeneration += 1;
    liveSession = {authenticated:false};
    liveCartPayload = null;
    liveCheckoutOptions = null;
    const selection = $('#selectionItems');
    selection?.replaceChildren(statusElement('empty-state', message));
    if ($('#selectionTotal')) $('#selectionTotal').textContent = '—';
    if ($('#cartRuntimeStatus')) $('#cartRuntimeStatus').textContent = message;
    $('#checkoutActivationHost')?.replaceChildren(statusElement('checkout-live-result', message));
  }

  function localPreviewPrice(item) {
    const kind = String(item.official_catalog_price_kind || item.official_catalog_price_type || '').toUpperCase();
    const openPrice = kind === 'OPEN_PRICE' || String(item.official_catalog_price_text || '').includes('オープン価格');
    if (catalogAuthorityConfigured()) {
      const priceId = typeof item.approved_sale_price_id === 'string' ? item.approved_sale_price_id : '';
      const priceVersion = typeof item.approved_sale_price_version === 'string' ? item.approved_sale_price_version : '';
      const adminAmount = currentPrice(item);
      const hasApprovedLivePrice = catalogAuthorityReady() && priceId && priceVersion.startsWith(`${priceId}:`) &&
        Number.isInteger(Number(adminAmount)) && Number(adminAmount) > 0;
      if (hasApprovedLivePrice) return {amount:Number(adminAmount), text:yen(adminAmount), label:'承認販売価格'};
      if (openPrice) return {amount:null, text:'オープン価格', label:'公式カタログ掲載・販売価格未設定'};
      return {amount:null, text:'販売価格確認中', label:'販売価格を確認できません'};
    }
    const adminAmount = currentPrice(item);
    if (openPrice) return {amount:null, text:'オープン価格', label:'公式カタログ掲載・販売価格未設定'};
    if (adminAmount != null) return {amount:Number(adminAmount), text:yen(adminAmount), label:'表示価格'};
    const rawOfficialAmount = item.official_catalog_price_jpy;
    const officialAmount = rawOfficialAmount != null && Number.isFinite(Number(rawOfficialAmount)) ? Number(rawOfficialAmount) : null;
    const tax = item.official_catalog_price_tax_included === true ? '税込' : item.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
    if (officialAmount != null) return {amount:officialAmount, text:yen(officialAmount), label:`${officialPriceKindLabel(kind)}（${tax}）`};
    return {amount:null, text:'価格情報なし', label:'商品情報をご確認ください'};
  }

  function restoreSelection() {
    return commerce().readCart()
      .map((line) => ({item:catalog().find((item) => item.id === line.id), quantity:line.quantity}))
      .filter((line) => line.item);
  }

  function updateLocalSelection(productId, delta = 0, remove = false) {
    const lines = commerce().readCart();
    const current = lines.find((line) => line.id === productId);
    if (!current) return;
    const next = remove
      ? lines.filter((line) => line.id !== productId)
      : lines.map((line) => line.id === productId
        ? {...line, quantity:Math.min(commerce().maxQuantity, Math.max(1, line.quantity + delta))}
        : line);
    commerce().writeCart(next);
    renderLocalSelection();
    renderLiveCheckout();
  }

  async function updateServerSelection(productId, action) {
    const status = $('#cartRuntimeStatus');
    announce(status, '会員カートを更新しています。');
    try {
      liveCartPayload = action === 'remove'
        ? await live().removeCartItem(productId)
        : await live().adjustCartItem(productId, action);
      renderServerSelection(liveCartPayload);
      renderLiveCheckout();
    } catch {
      announce(status, '会員カートを更新できませんでした。時間をおいて再度お試しください。', true);
    }
  }

  function selectionControls({productId, quantity, onChange, onRemove}) {
    const controls = element('div', {className:'selection-controls'});
    controls.setAttribute('aria-label', '数量を変更');
    const minus = element('button', {type:'button', text:'−'});
    minus.setAttribute('aria-label', '数量を1減らす');
    minus.disabled = quantity <= 1;
    const count = element('output', {text:String(quantity)});
    count.setAttribute('aria-label', `数量 ${quantity}`);
    const plus = element('button', {type:'button', text:'＋'});
    plus.setAttribute('aria-label', '数量を1増やす');
    plus.disabled = quantity >= commerce().maxQuantity;
    const remove = element('button', {type:'button', text:'削除'});
    remove.className = 'selection-remove';
    remove.setAttribute('aria-label', 'カートから削除');
    minus.addEventListener('click', () => onChange(-1));
    plus.addEventListener('click', () => onChange(1));
    remove.addEventListener('click', onRemove);
    controls.append(minus, count, plus, remove);
    return controls;
  }

  function localSelectionTotals() {
    let knownSubtotal = 0;
    let hasUnknownPrice = false;
    restoreSelection().forEach(({item, quantity}) => {
      const price = localPreviewPrice(item).amount;
      if (price == null) hasUnknownPrice = true;
      else knownSubtotal += Number(price) * quantity;
    });
    return {knownSubtotal, hasUnknownPrice};
  }

  function renderLocalSelection() {
    const items = restoreSelection();
    const host = $('#selectionItems');
    host.replaceChildren();
    const protectedCatalogPending = catalogAuthorityConfigured() && !catalogAuthorityReady();
    $('#selectionTotalLabel').textContent = protectedCatalogPending ? '販売価格確認中' : 'カタログ掲載価格の小計';
    $('#selectionPriceNote').textContent = protectedCatalogPending
      ? '商品管理サービスから承認販売価格を確認できないため、価格と注文操作を停止しています。'
      : '商品ページの掲載価格を使った小計です。在庫と送料は注文確定前に確認します。';
    if (!items.length) {
      const empty = element('div', {className:'empty-state'});
      empty.append(element('b', {text:'カートに商品がありません。'}), element('p', {text:'商品案内から商品を追加してください。'}));
      host.append(empty);
      $('#selectionTotal').textContent = '¥0';
      $('#cartRuntimeStatus').textContent = '商品を追加すると、ご注文内容を確認できます。';
      return;
    }
    const totals = localSelectionTotals();
    items.forEach(({item, quantity}) => {
      const previewPrice = localPreviewPrice(item);
      const line = element('article', {className:'selection-line'});
      const copy = element('div');
      copy.append(
        element('b', {text:customerProductName(item)}),
        element('small', {text:`${item.product_code || item.sku || '品番未登録'} / ${previewPrice.label}`}),
        selectionControls({
          productId:item.id,
          quantity,
          onChange:(delta) => updateLocalSelection(item.id, delta),
          onRemove:() => updateLocalSelection(item.id, 0, true),
        }),
      );
      const lineTotal = previewPrice.amount == null
        ? `${previewPrice.text}（小計対象外）`
        : `${yen(previewPrice.amount * quantity)}${quantity === 1 ? '' : `（${yen(previewPrice.amount)} × ${quantity}）`}`;
      line.append(copy, element('strong', {text:lineTotal}));
      host.append(line);
    });
    $('#selectionTotal').textContent = totals.hasUnknownPrice
      ? `${totals.knownSubtotal ? `計算可能分 ${yen(totals.knownSubtotal)} + ` : ''}未算定商品あり`
      : yen(totals.knownSubtotal);
    $('#cartRuntimeStatus').textContent = `${items.length}商品の内容を確認できます。`;
  }

  function isApprovedPriceSource(value) {
    return ['approved_price_list', 'approved-sale-price', 'APPROVED_PRICE_LIST'].includes(String(value || ''));
  }

  function normalizeServerLines(payload) {
    const lines = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.cart?.items) ? payload.cart.items : [];
    return lines.map((line) => ({
      id:line.productId || line.id,
      name:line.productName || line.name || line.productId || line.id,
      quantity:Number(line.quantity || 0),
      unitPrice:Number(line.unitPrice ?? line.unitPriceJpy ?? line.price ?? 0),
      lineTotal:Number(line.lineTotalJpy ?? line.lineTotal ?? line.total ?? 0),
      priceSource:line.price?.status === 'approved' ? 'approved_price_list' : line.priceSource || line.price?.source || payload?.priceSource || payload?.totals?.priceSource,
    })).filter((line) => line.id && Number.isInteger(line.quantity) && line.quantity > 0);
  }

  function approvedCartSubtotal(payload) {
    const lines = normalizeServerLines(payload);
    if (!lines.length || !lines.every((line) => isApprovedPriceSource(line.priceSource))) return null;
    return lines.reduce((sum, line) => sum + (line.lineTotal || line.unitPrice * line.quantity), 0);
  }

  function renderServerSelection(payload) {
    const lines = normalizeServerLines(payload);
    const host = $('#selectionItems');
    host.replaceChildren();
    $('#selectionTotalLabel').textContent = '販売価格の小計';
    $('#selectionPriceNote').textContent = '在庫と販売価格は保護された商品台帳で確認されています。';
    if (!lines.length) {
      host.append(statusElement('empty-state', '会員カートは空です。商品案内から商品を追加してください。'));
      $('#selectionTotal').textContent = '¥0';
      return;
    }
    let subtotal = 0;
    let allApproved = true;
    lines.forEach((item) => {
      const approved = isApprovedPriceSource(item.priceSource);
      allApproved = allApproved && approved;
      if (approved) subtotal += item.lineTotal || item.unitPrice * item.quantity;
      const line = element('article', {className:'selection-line'});
      const copy = element('div');
      copy.append(
        element('b', {text:item.name}),
        element('small', {text:item.id}),
        selectionControls({
          productId:item.id,
          quantity:item.quantity,
          onChange:(delta) => updateServerSelection(item.id, delta),
          onRemove:() => updateServerSelection(item.id, 'remove'),
        }),
      );
      line.append(copy, element('strong', {text:approved ? yen(item.lineTotal || item.unitPrice * item.quantity) : '販売価格確認中'}));
      host.append(line);
    });
    $('#selectionTotal').textContent = allApproved ? yen(subtotal) : `${subtotal ? `${yen(subtotal)} + ` : ''}確認中の商品あり`;
    $('#cartRuntimeStatus').textContent = `${lines.length}商品の在庫と販売価格を確認しました。`;
  }

  function serverSelectionIsAuthoritative() {
    const client = live();
    return Boolean(
      client?.configured &&
      client.isActivated(liveCapabilities) &&
      liveSession?.authenticated === true &&
      normalizeServerLines(liveCartPayload).length,
    );
  }

  function renderAuthoritativeSelection() {
    if (serverSelectionIsAuthoritative()) {
      renderServerSelection(liveCartPayload);
      return 'server';
    }
    renderLocalSelection();
    return 'local';
  }

  function normalizeCheckoutOptions(payload) {
    const policy = payload?.deliveryPolicy;
    const minDays = Number(policy?.minDays);
    const maxDays = Number(policy?.maxDays);
    const services = Array.isArray(payload?.services) ? payload.services.map((service) => ({
      id:String(service?.id || ''), label:String(service?.label || ''), feeJpy:Number(service?.feeJpy),
      freeShippingThresholdJpy:service?.freeShippingThresholdJpy == null ? null : Number(service.freeShippingThresholdJpy),
    })).filter((service) => service.id && service.label && Number.isInteger(service.feeJpy) && service.feeJpy >= 0 &&
      (service.freeShippingThresholdJpy == null || (Number.isInteger(service.freeShippingThresholdJpy) && service.freeShippingThresholdJpy >= 0))) : [];
    const timeSlots = Array.isArray(policy?.timeSlots) ? policy.timeSlots.map((slot) => ({
      id:String(slot?.id || ''), label:String(slot?.label || ''),
    })).filter((slot) => slot.id && slot.label) : [];
    if (payload?.currency !== 'JPY' || !services.length || policy?.timeZone !== 'Asia/Tokyo' ||
      !Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 0 || maxDays < minDays || maxDays > 31 || !timeSlots.length) return null;
    return {
      currency:'JPY', services,
      deliveryPolicy:{
        timeZone:'Asia/Tokyo', minDays, maxDays, timeSlots,
        faceToFaceDelivery:policy.faceToFaceDelivery === true,
        ageVerificationRequired:policy.ageVerificationRequired === true,
        leaveAtDoorAllowed:policy.leaveAtDoorAllowed === true,
      },
    };
  }

  function tokyoDateParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit',
    }).formatToParts(date);
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  }

  function deliveryDates(policy, now = new Date()) {
    const today = tokyoDateParts(now);
    const base = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), 12);
    const weekday = new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo', weekday:'short'});
    const dates = [];
    for (let offset = policy.minDays; offset <= policy.maxDays; offset += 1) {
      const date = new Date(base + offset * 86400000);
      const value = date.toISOString().slice(0, 10);
      const [year, month, day] = value.split('-');
      dates.push({value, label:`${year}年${month}月${day}日 (${weekday.format(date)})`});
    }
    return dates;
  }

  function shippingFee(service, subtotal) {
    const threshold = service.freeShippingThresholdJpy;
    return threshold != null && subtotal >= threshold ? 0 : service.feeJpy;
  }

  function safeProviderAction(payload) {
    const order = payload?.order || payload;
    const attempts = Array.isArray(order?.paymentAttempts) ? order.paymentAttempts : [];
    const persistedAction = [...attempts].reverse().find((attempt) => attempt?.clientAction)?.clientAction;
    const candidates = [
      {kind:'identity', action:payload?.ageVerification?.clientAction || order?.ageVerification?.clientAction},
      {kind:'payment', action:payload?.payment?.clientAction || order?.payment?.clientAction || persistedAction},
      {kind:String(order?.status || '').toUpperCase() === 'AGE_VERIFICATION_PENDING' ? 'identity' : 'payment', action:payload?.nextAction || payload?.redirectUrl},
    ];
    for (const candidate of candidates) {
      const value = typeof candidate.action === 'string' ? candidate.action : candidate.action?.url;
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol === 'https:') return {kind:candidate.kind, url:url.href};
      } catch {}
    }
    return null;
  }

  function flowStep(number, title, copy, id) {
    const section = element('section', {className:'checkout-step'});
    if (id) section.id = id;
    const head = element('div', {className:'checkout-step-heading'});
    const copyWrap = element('div');
    copyWrap.append(element('h3', {text:title}), element('p', {text:copy}));
    head.append(element('span', {text:String(number).padStart(2, '0')}), copyWrap);
    section.append(head);
    return section;
  }

  function labeledInput(name, type, labelText, autocomplete, {required = true, full = false} = {}) {
    const label = element('label', {className:full ? 'full-width' : ''});
    label.append(element('span', {text:labelText}));
    const input = element('input', {type});
    input.name = name;
    input.autocomplete = autocomplete;
    input.required = required;
    label.append(input);
    return {label, input};
  }

  function buildAddressFields() {
    const fields = element('div', {className:'checkout-live-fields'});
    const definitions = [
      ['recipientName','text','受取人氏名','name',false], ['phone','tel','電話番号','tel',false],
      ['postalCode','text','郵便番号','postal-code',false], ['prefecture','text','都道府県','address-level1',false],
      ['addressLine','text','市区町村・番地・建物名','street-address',true],
    ];
    const inputs = {};
    definitions.forEach(([name, type, labelText, autocomplete, full]) => {
      const field = labeledInput(name, type, labelText, autocomplete, {full});
      inputs[name] = field.input;
      fields.append(field.label);
    });
    return {fields, inputs};
  }

  function complianceNote() {
    const note = element('aside', {className:'checkout-compliance'});
    note.setAttribute('role', 'note');
    note.append(element('b', {text:'お受け取り時の確認'}));
    const list = element('ul');
    ['対面受取', '受取時年齢確認', '置き配不可'].forEach((item) => list.append(element('li', {text:item})));
    note.append(list);
    return note;
  }

  function selectField(name, labelText, options) {
    const label = element('label');
    label.append(element('span', {text:labelText}));
    const select = element('select');
    select.name = name;
    select.required = true;
    options.forEach(({value, text}) => {
      const option = element('option', {text});
      option.value = value;
      select.append(option);
    });
    label.append(select);
    return {label, select};
  }

  function totalSummary(subtotal, services, carrier, provisional = false, hasUnknownPrice = false) {
    const box = element('section', {className:'checkout-total-summary'});
    box.setAttribute('aria-live', 'polite');
    const subtotalValue = element('strong');
    const shippingValue = element('strong');
    const grandTotalValue = element('strong');
    const shippingRule = element('small');
    const row = (label, value, className = '') => {
      const item = element('div', {className});
      item.append(element('span', {text:label}), value);
      return item;
    };
    box.append(
      row(provisional ? '商品小計（掲載価格）' : '商品小計', subtotalValue),
      row(provisional ? '配送料（概算）' : '配送料', shippingValue),
      row(provisional ? '合計目安' : 'お支払い予定額', grandTotalValue, 'grand-total'),
      shippingRule,
    );
    const update = () => {
      const service = services.find((item) => item.id === carrier.value) || services[0];
      if (!service) return;
      if (hasUnknownPrice) {
        subtotalValue.textContent = subtotal > 0 ? `計算可能分 ${yen(subtotal)} + 未算定` : '未算定';
        shippingValue.textContent = '—';
        grandTotalValue.textContent = '算定できません';
        shippingRule.textContent = '価格未設定の商品があるため、送料と合計は表示できません。';
        return;
      }
      const fee = shippingFee(service, subtotal);
      subtotalValue.textContent = yen(subtotal);
      shippingValue.textContent = fee === 0 ? '送料無料' : yen(fee);
      grandTotalValue.textContent = yen(subtotal + fee);
      shippingRule.textContent = provisional
        ? '掲載価格と配送条件を使った目安です。確定する在庫と送料は注文手続きで確認します。'
        : service.freeShippingThresholdJpy == null
          ? `${service.label}の配送料を適用しています。`
          : `${service.label}は商品小計${yen(service.freeShippingThresholdJpy)}以上で送料無料です。`;
    };
    carrier.addEventListener('change', update);
    update();
    return box;
  }

  function finalUnavailableMessage(reason) {
    return reason || '年齢確認・決済・配送サービスがまだ有効化されていないため、オンライン注文は確定できません。入力内容は送信・保存されていません。';
  }

  function renderPreviewCheckout(reason = '') {
    const host = $('#checkoutActivationHost');
    host.replaceChildren();
    const availability = element('aside', {className:'checkout-availability-banner'});
    availability.setAttribute('role', 'status');
    availability.append(
      element('b', {text:'現在は注文受付前です'}),
      element('p', {text:reason || '会員認証・年齢確認・決済・配送の外部サービス接続後に注文を確定できます。以下の入力欄では画面と流れを確認できますが、内容は送信・保存されません。'}),
    );
    const form = element('form', {className:'checkout-live-form checkout-preview-form'});
    form.noValidate = true;

    const identity = flowStep(2, '会員・年齢確認', '注文確定前に、会員情報と20歳以上であることを確認します。', 'memberStep');
    const email = labeledInput('email', 'email', 'メールアドレス', 'email');
    const ageLabel = element('label', {className:'checkout-consent'});
    const age = element('input', {type:'checkbox'});
    age.name = 'ageAcknowledgement';
    age.required = true;
    ageLabel.append(age, document.createTextNode('20歳以上で、注文確定前に年齢・本人確認を行うことを確認しました。'));
    identity.append(email.label, ageLabel, element('p', {className:'step-note', text:'本人確認書類は、この画面では送信しません。'}));

    const delivery = flowStep(3, '配送', 'お届け先と希望日時を入力します。', 'deliveryStep');
    const {fields, inputs} = buildAddressFields();
    const previewMethods = (logistics()?.shippingMethods || []).map((method) => ({
      id:method.id, label:method.name, feeJpy:Number(method.fee || 0), freeShippingThresholdJpy:null,
    }));
    const services = previewMethods.length ? previewMethods : [{id:'standard', label:'標準配送', feeJpy:0, freeShippingThresholdJpy:null}];
    const carrierField = selectField('carrierService', '配送方法', services.map((service) => ({
      value:service.id, text:`${service.label} / 概算 ${yen(service.feeJpy)}`,
    })));
    const previewPolicy = {
      timeZone:'Asia/Tokyo', minDays:3, maxDays:10,
      timeSlots:(logistics()?.timeSlots || [{id:'none', label:'指定なし'}]).map((slot) => ({id:slot.id, label:slot.label})),
    };
    const dateField = selectField('deliveryDate', '指定配達日', deliveryDates(previewPolicy).map((date) => ({value:date.value, text:date.label})));
    const timeField = selectField('timeSlot', '指定時間帯', previewPolicy.timeSlots.map((slot) => ({value:slot.id, text:slot.label})));
    fields.append(carrierField.label, dateField.label, timeField.label);
    delivery.append(fields, complianceNote());

    const payment = flowStep(4, 'お支払い', '注文確定時に、安全な決済サービスで支払い方法を選択します。', 'paymentStep');
    const paymentChoice = element('div', {className:'payment-choice'});
    paymentChoice.append(element('b', {text:'決済サービスでお支払い'}), element('p', {text:'カード番号などの決済情報はKISARAGIの画面に保存しません。'}));
    payment.append(paymentChoice);

    const confirm = flowStep(5, '注文内容の確認', '商品、配送先、受取方法、お支払い予定額を確認します。', 'confirmStep');
    const totals = localSelectionTotals();
    confirm.append(totalSummary(totals.knownSubtotal, services, carrierField.select, true, totals.hasUnknownPrice));
    if (totals.hasUnknownPrice) confirm.append(element('p', {className:'step-note', text:'価格未設定の商品を削除するか、販売価格が登録されるまでお待ちください。'}));
    const submit = element('button', {type:'submit', text:'外部サービス接続後に注文可能'});
    submit.className = 'checkout-submit';
    submit.disabled = true;
    const result = element('div', {className:'checkout-live-result'});
    result.tabIndex = -1;
    if (!restoreSelection().length) {
      submit.textContent = '商品を選択してください';
    }
    confirm.append(submit, result);
    form.append(identity, delivery, payment, confirm);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      announce(result, finalUnavailableMessage(reason), true);
    });
    host.append(availability, form);
  }

  function renderMemberGate() {
    const host = $('#checkoutActivationHost');
    host.replaceChildren();
    const step = flowStep(2, '会員・年齢確認', 'ご注文手続きは、保護された会員セッションで行います。', 'memberStep');
    const link = element('a', {className:'outline-button', text:'会員ログイン・登録へ進む'});
    link.href = './account.html';
    step.append(link);
    host.append(step);
  }

  function renderCartTransfer() {
    const host = $('#checkoutActivationHost');
    host.replaceChildren();
    const localLines = commerce().readCart();
    if (!localLines.length) {
      host.append(statusElement('checkout-live-result', 'カートに商品がありません。商品案内から商品を追加してください。'));
      return;
    }
    const step = flowStep(1, 'カート内容を会員情報に反映', 'この端末で選んだ商品と数量を、保護された会員カートへ反映します。');
    const button = element('button', {type:'button', text:'会員カートへ反映する'});
    const result = element('div', {className:'checkout-live-result'});
    button.addEventListener('click', async () => {
      button.disabled = true;
      announce(result, 'カート内容を確認しています。');
      try {
        for (const line of localLines) await live().setCartItem(line.id, line.quantity);
        liveCartPayload = await live().cart();
        renderServerSelection(liveCartPayload);
        renderLiveCheckout();
      } catch {
        announce(result, 'カート内容を反映できませんでした。時間をおいて再度お試しください。', true);
        button.disabled = false;
      }
    });
    step.append(button, result);
    host.append(step);
  }

  function renderLiveCheckout() {
    if (!live().isActivated(liveCapabilities)) return renderPreviewCheckout();
    if (!liveSession.authenticated) return renderMemberGate();
    if (!normalizeServerLines(liveCartPayload).length) return renderCartTransfer();
    const options = liveCheckoutOptions;
    const services = options?.services || [];
    const policy = options?.deliveryPolicy;
    const subtotal = approvedCartSubtotal(liveCartPayload);
    if (!services.length || !policy || subtotal == null || !policy.faceToFaceDelivery || !policy.ageVerificationRequired || policy.leaveAtDoorAllowed) {
      renderPreviewCheckout('注文に必要な販売価格、配送方法、受取条件を確認できないため、オンライン注文は確定できません。入力内容は送信・保存されていません。');
      return;
    }

    const host = $('#checkoutActivationHost');
    host.replaceChildren();
    const form = element('form', {className:'checkout-live-form'});
    form.noValidate = true;
    const identity = flowStep(2, '会員・年齢確認', '会員ログインを確認しました。注文確定時にeKYCで年齢・本人確認を行います。', 'memberStep');
    identity.append(element('p', {className:'verified-line', text:'会員セッションを確認済み'}));
    const delivery = flowStep(3, '配送', 'お届け先、配送方法、希望日時を指定します。', 'deliveryStep');
    const {fields, inputs} = buildAddressFields();
    const carrierField = selectField('carrierService', '配送方法', services.map((service) => {
      const threshold = service.freeShippingThresholdJpy == null ? '' : `（${yen(service.freeShippingThresholdJpy)}以上は送料無料）`;
      return {value:service.id, text:`${service.label} / ${yen(service.feeJpy)}${threshold}`};
    }));
    const dateField = selectField('deliveryDate', '指定配達日', deliveryDates(policy).map((date) => ({value:date.value, text:date.label})));
    const timeField = selectField('timeSlot', '指定時間帯', policy.timeSlots.map((slot) => ({value:slot.id, text:slot.label})));
    fields.append(carrierField.label, dateField.label, timeField.label);
    delivery.append(fields, complianceNote());
    const payment = flowStep(4, 'お支払い', '注文内容の確認後、安全な本人確認・決済サービスへ進みます。', 'paymentStep');
    const paymentChoice = element('div', {className:'payment-choice'});
    paymentChoice.append(element('b', {text:'安全な外部決済'}), element('p', {text:'決済完了は事業者からの確定応答を受けた後に注文履歴へ反映します。'}));
    payment.append(paymentChoice);
    const confirm = flowStep(5, '注文内容の確認', '内容を確認して仮注文を保存し、年齢確認とお支払いへ進みます。', 'confirmStep');
    confirm.append(totalSummary(subtotal, services, carrierField.select));
    const submit = element('button', {type:'submit', text:'在庫と価格を確認して注文手続きへ'});
    submit.className = 'checkout-submit';
    const result = element('div', {className:'checkout-live-result'});
    let draftPersisted = false;
    const expectedSessionIdentity = sessionIdentity(liveSession);
    confirm.append(submit, result);
    form.append(identity, delivery, payment, confirm);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (draftPersisted) {
        announce(result, 'この仮注文は保存済みです。下のボタンから本人確認・お支払いへ進んでください。');
        return;
      }
      if (!form.reportValidity() || !live().isActivated(liveCapabilities)) {
        announce(result, finalUnavailableMessage(), true);
        return;
      }
      submit.disabled = true;
      announce(result, '会員セッションを再確認しています。');
      try {
        const currentSession = await live().session();
        if (!expectedSessionIdentity || sessionIdentity(currentSession) !== expectedSessionIdentity) {
          clearSensitiveCheckoutView('会員が切り替わったため、注文内容を再読み込みしています。');
          await initializeLiveCommerce();
          return;
        }
        liveSession = currentSession;
        announce(result, '在庫と販売価格を確認しています。');
        const draft = await live().createDraftOrder({
          recipientName:inputs.recipientName.value, phone:inputs.phone.value, postalCode:inputs.postalCode.value,
          prefecture:inputs.prefecture.value, addressLine:inputs.addressLine.value,
        }, carrierField.select.value, dateField.select.value, timeField.select.value);
        const persistedOrder = draft.order || draft;
        const orderId = persistedOrder.id || persistedOrder.orderId;
        const persistedStatus = persistedOrder.status || 'DRAFT';
        draftPersisted = true;
        commerce().writeCart([]);
        liveCartPayload = {items:[]};
        renderLocalSelection();
        form.querySelectorAll('input, select').forEach((control) => { control.disabled = true; });
        submit.disabled = true;
        submit.textContent = '仮注文を保存済み';
        result.replaceChildren(
          element('b', {text:`仮注文 ${orderId || '保存済み'}`}),
          element('p', {text:`状態：${orderStatusLabel(persistedStatus)}。年齢確認、支払い、配送はまだ完了していません。`}),
        );
        if (!orderId) return;
        const activate = element('button', {type:'button', text:'年齢確認・お支払いへ進む'});
        const activationStatus = element('p', {className:'checkout-processing-status'});
        const activationResult = element('div', {className:'checkout-provider-action'});
        let activationStarted = false;
        const renderOrderState = (response, includeProviderAction = false) => {
          const order = response?.order || response;
          activationResult.replaceChildren(element('p', {text:`注文状態：${orderStatusLabel(order?.status)}`}));
          const providerAction = includeProviderAction ? safeProviderAction(response) : null;
          if (providerAction) {
            const link = element('a', {
              className:'outline-button',
              text:providerAction.kind === 'identity' ? '本人確認事業者へ進む' : '決済事業者へ進む',
            });
            link.href = providerAction.url;
            link.rel = 'noopener noreferrer';
            activationResult.append(link);
          }
          return providerAction;
        };
        activate.addEventListener('click', async () => {
          activate.disabled = true;
          if (activationStarted) {
            activate.textContent = '注文状態を確認中...';
            announce(activationStatus, '保存された注文の最新状態を確認しています。');
            try {
              const response = await live().order(orderId);
              const providerAction = renderOrderState(response, true);
              announce(activationStatus, providerAction
                ? providerAction.kind === 'identity'
                  ? '本人確認事業者の画面で年齢・本人確認を続けてください。完了後にもう一度この状態を確認してください。'
                  : '決済事業者の画面でお支払いを続けてください。'
                : '注文状態を更新しました。');
            } catch {
              announce(activationStatus, '注文状態を確認できませんでした。時間をおいて再度お試しください。', true);
            } finally {
              activate.disabled = false;
              activate.textContent = '注文状態を再確認する';
            }
            return;
          }
          activate.textContent = 'eKYC 年齢確認処理中...';
          announce(activationStatus, '本人確認事業者の応答を待っています。');
          try {
            const response = await live().activateOrder(orderId);
            activate.textContent = '決済処理状況を確認中...';
            announce(activationStatus, '年齢確認の応答を受領し、決済事業者の受付状態を確認しています。');
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const providerAction = renderOrderState(response, true);
            activationStarted = true;
            announce(activationStatus, providerAction
              ? providerAction.kind === 'identity'
                ? '本人確認事業者の画面で年齢・本人確認を続けてください。確認後、この画面で注文状態を再確認してください。'
                : '決済事業者の画面でお支払いを続けてください。'
              : '外部手続きを受け付けました。確定結果は注文履歴へ反映されます。');
            activate.textContent = '注文状態を再確認する';
          } catch {
            announce(activationStatus, '年齢確認または決済サービスを開始できませんでした。注文は確定していません。', true);
            activate.textContent = '年齢確認・お支払いを再試行';
          } finally {
            activate.disabled = false;
          }
        });
        result.append(activate, activationStatus, activationResult);
      } catch (error) {
        announce(result, error.payload?.message || '仮注文を保存できませんでした。在庫、価格、入力内容をご確認ください。', true);
      } finally {
        if (!draftPersisted) submit.disabled = false;
      }
    });
    host.append(form);
  }

  function setNeutralNotice(active = false) {
    const notice = $('#commerceRuntimeNotice');
    notice.dataset.state = active ? 'active' : 'checking';
    notice.querySelector('strong').textContent = active ? '安全なご注文手続き' : '現在は注文受付前です';
    notice.querySelector('span').textContent = active
      ? '在庫、販売価格、年齢確認、配送、お支払いを順に確認します。'
      : '外部サービス接続前のため注文は確定できません。画面上で入力した内容は送信・保存されません。';
  }

  async function initializeLiveCommerce() {
    const generation = ++liveRefreshGeneration;
    if (!live()?.configured) {
      if (generation !== liveRefreshGeneration) return;
      setNeutralNotice(false);
      renderPreviewCheckout();
      return;
    }
    try {
      const nextCapabilities = await live().capabilities();
      if (generation !== liveRefreshGeneration) return;
      if (!live().isActivated(nextCapabilities)) {
        liveCapabilities = nextCapabilities;
        liveSession = {authenticated:false};
        liveCartPayload = null;
        liveCheckoutOptions = null;
        setNeutralNotice(false);
        renderPreviewCheckout();
        return;
      }
      const nextSession = await live().session();
      let nextCartPayload = null;
      let nextCheckoutOptions = null;
      if (nextSession.authenticated) {
        [nextCartPayload, nextCheckoutOptions] = await Promise.all([
          live().cart(),
          live().checkoutOptions().then(normalizeCheckoutOptions),
        ]);
      }
      if (generation !== liveRefreshGeneration) return;
      liveCapabilities = nextCapabilities;
      liveSession = nextSession;
      liveCartPayload = nextCartPayload;
      liveCheckoutOptions = nextCheckoutOptions;
      renderAuthoritativeSelection();
      setNeutralNotice(true);
      renderLiveCheckout();
    } catch {
      if (generation !== liveRefreshGeneration) return;
      liveSession = {authenticated:false};
      liveCartPayload = null;
      liveCheckoutOptions = null;
      setNeutralNotice(false);
      renderPreviewCheckout('注文サービスを確認できないため、オンライン注文は確定できません。入力内容は送信・保存されていません。');
    }
  }

  function scheduleCheckoutReload(message) {
    clearSensitiveCheckoutView(message);
    const refresh = initializeLiveCommerce();
    liveRefreshPromise = refresh;
    return refresh.finally(() => {
      if (liveRefreshPromise === refresh) liveRefreshPromise = null;
    });
  }

  function revalidateCheckoutIdentity() {
    if (!live()?.configured || !live().isActivated(liveCapabilities) || identityRefreshPromise) return identityRefreshPromise;
    const expected = sessionIdentity(liveSession);
    identityRefreshPromise = live().session()
      .then((nextSession) => {
        if (!expected || sessionIdentity(nextSession) !== expected) {
          return scheduleCheckoutReload('会員が切り替わったため、注文内容を再読み込みしています。');
        }
        liveSession = nextSession;
        return null;
      })
      .catch(() => scheduleCheckoutReload('会員セッションを確認できないため、注文内容を再読み込みしています。'))
      .finally(() => { identityRefreshPromise = null; });
    return identityRefreshPromise;
  }

  function initializeAgeGate() {
    if (globalThis.KISARAGI_AGE_GATE?.initialized) return;
    const gate = $('#ageGate');
    const enter = $('#enterSite');
    if (!gate || !enter) return;
    let verified = false;
    try { verified = sessionStorage.getItem('kisaragi-age-verified') === '1'; } catch {}
    if (verified) {
      gate.hidden = true;
      return;
    }
    const background = [...document.body.children].filter((element) => element !== gate && element.tagName !== 'SCRIPT');
    const previous = background.map((element) => ({element, inert:element.inert, aria:element.getAttribute('aria-hidden')}));
    const priorOverflow = document.body.style.overflow;
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    const focusable = () => [...gate.querySelectorAll('button, [href]')];
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    gate.addEventListener('keydown', trap);
    enter.addEventListener('click', () => {
      try { sessionStorage.setItem('kisaragi-age-verified', '1'); } catch {}
      gate.hidden = true;
      gate.removeEventListener('keydown', trap);
      previous.forEach(({element, inert, aria}) => {
        element.inert = inert;
        if (aria === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', aria);
      });
      document.body.style.overflow = priorOverflow;
      $('#selection')?.focus?.({preventScroll:true});
    }, {once:true});
    requestAnimationFrame(() => enter.focus());
  }

  async function init() {
    initializeAgeGate();
    if (!commerce()) {
      $('#checkoutActivationHost').replaceChildren(statusElement('checkout-live-result', 'カートを読み込めませんでした。ページを再読み込みしてください。', true));
      return;
    }
    renderLocalSelection();
    await initializeLiveCommerce();
  }

  globalThis.addEventListener?.('kisaragi-catalog-updated', renderAuthoritativeSelection);

  globalThis.addEventListener?.('storage', (event) => {
    if (event.key === live()?.sessionRevisionKey) {
      scheduleCheckoutReload('会員が切り替わったため、注文内容を再読み込みしています。');
    }
  });
  globalThis.addEventListener?.('pageshow', revalidateCheckoutIdentity);
  globalThis.addEventListener?.('focus', revalidateCheckoutIdentity);
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (globalThis.document.visibilityState === 'visible') revalidateCheckoutIdentity();
  });

  if (document.readyState === 'loading') globalThis.addEventListener?.('DOMContentLoaded', init);
  else init();
})();
