(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const live = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const officialPriceKindLabel = (kind) => ({
    MANUFACTURER_LIST_PRICE_TAX_INCLUDED:'メーカー定価',
    MANUFACTURER_LIST_PRICE_TAX_INCLUSIVE:'メーカー定価',
    MANUFACTURER_LIST_PRICE:'メーカー定価',
    FIXED_LIST_PRICE:'定価',
    CATALOG_RETAIL_PRICE:'カタログ掲載小売価格',
    CATALOG_PRICE:'カタログ掲載価格',
    CATALOG_LISTED_PRICE:'カタログ掲載価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUDED:'希望小売価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUSIVE:'希望小売価格',
    SUGGESTED_RETAIL_PRICE:'希望小売価格',
    OPEN_PRICE:'オープン価格',
  })[String(kind || '').toUpperCase()] || '公式カタログ価格';
  const localPreviewPrice = (item) => {
    const adminAmount = currentPrice(item);
    if (adminAmount != null) return {amount:Number(adminAmount), text:yen(adminAmount), label:'管理者設定の表示価格'};
    const rawOfficialAmount = item.official_catalog_price_jpy;
    const officialAmount = rawOfficialAmount != null && Number.isFinite(Number(rawOfficialAmount)) ? Number(rawOfficialAmount) : null;
    const kind = String(item.official_catalog_price_kind || item.official_catalog_price_type || '').toUpperCase();
    const tax = item.official_catalog_price_tax_included === true ? '税込' : item.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
    const priceStatus = item.official_catalog_price_verification || item.official_catalog_price_extraction_status || '';
    const extractionStatus = String(priceStatus).toUpperCase();
    const sourceNote = extractionStatus === 'OCR_EXTRACTED'
      ? '・公式PDF OCR抽出' : /OCR_REVIEW_REQUIRED|PENDING/.test(extractionStatus) ? '・OCR確認待ち' : '';
    if (officialAmount != null) return {amount:officialAmount, text:yen(officialAmount), label:`${officialPriceKindLabel(kind)}（${tax}${sourceNote}）`};
    if (kind === 'OPEN_PRICE' || String(item.official_catalog_price_text || '').includes('オープン価格')) return {amount:null, text:'オープン価格', label:`公式カタログ価格${sourceNote}`};
    return {amount:null, text:'価格未登録', label:'販売価格未承認'};
  };
  let liveCapabilities = null;
  let liveSession = {authenticated:false};
  let liveCartPayload = null;
  let liveCheckoutOptions = null;

  function element(tag, {className, text, type} = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    if (type) node.type = type;
    return node;
  }

  function restoreSelection() {
    return commerce().readCart()
      .map((line) => ({item:catalog().find((item) => item.id === line.id), quantity:line.quantity}))
      .filter((line) => line.item);
  }

  function renderLocalSelection() {
    const items = restoreSelection();
    const host = $('#selectionItems');
    host.replaceChildren();
    $('#selectionTotalLabel').textContent = '参考金額の小計（注文価格ではありません）';
    $('#selectionPriceNote').textContent = '管理者設定の表示価格または公式カタログ価格を使った参考計算です。現在の販売価格・承認済み注文価格ではなく、注文処理には使用しません。';
    if (!items.length) {
      const empty = element('div', {className:'empty-state'});
      empty.append(element('b', {text:'選択された商品はありません。'}), element('p', {text:'商品案内から気になる商品を追加してください。'}));
      host.append(empty);
      $('#selectionTotal').textContent = '¥0';
      return;
    }

    let knownSubtotal = 0;
    let hasUnknownPrice = false;
    items.forEach(({item, quantity}) => {
      const previewPrice = localPreviewPrice(item);
      const price = previewPrice.amount;
      if (price == null) hasUnknownPrice = true;
      else knownSubtotal += Number(price) * quantity;
      const line = element('article', {className:'selection-line'});
      const copy = element('div');
      copy.append(
        element('b', {text:item.product_name_ja || item.name || '商品名未登録'}),
        element('small', {text:`${item.product_code || item.sku || '品番未登録'} / 数量 ${quantity} / ${previewPrice.label} / 注文価格ではありません`}),
      );
      const total = price == null ? `${previewPrice.text}（小計対象外）` : `${yen(Number(price) * quantity)}${quantity === 1 ? '' : `（${yen(price)} × ${quantity}）`}`;
      line.append(copy, element('strong', {text:total}));
      host.append(line);
    });
    $('#selectionTotal').textContent = hasUnknownPrice
      ? `${knownSubtotal ? `計算可能分 ${yen(knownSubtotal)} + ` : ''}未算定商品あり`
      : yen(knownSubtotal);
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

  function normalizeCheckoutOptions(payload) {
    const policy = payload?.deliveryPolicy;
    const minDays = Number(policy?.minDays);
    const maxDays = Number(policy?.maxDays);
    const services = Array.isArray(payload?.services) ? payload.services.map((service) => ({
      id:String(service?.id || ''),
      label:String(service?.label || ''),
      feeJpy:Number(service?.feeJpy),
      freeShippingThresholdJpy:service?.freeShippingThresholdJpy == null
        ? null
        : Number(service.freeShippingThresholdJpy),
    })).filter((service) => service.id && service.label && Number.isInteger(service.feeJpy) && service.feeJpy >= 0 &&
      (service.freeShippingThresholdJpy == null || (Number.isInteger(service.freeShippingThresholdJpy) && service.freeShippingThresholdJpy >= 0))) : [];
    const timeSlots = Array.isArray(policy?.timeSlots) ? policy.timeSlots.map((slot) => ({
      id:String(slot?.id || ''),
      label:String(slot?.label || ''),
    })).filter((slot) => slot.id && slot.label) : [];
    if (payload?.currency !== 'JPY' || !services.length || policy?.timeZone !== 'Asia/Tokyo' ||
      !Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 0 || maxDays < minDays || maxDays > 31 || !timeSlots.length) return null;
    return {
      currency:'JPY',
      services,
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

  function renderServerSelection(payload) {
    const lines = normalizeServerLines(payload);
    const host = $('#selectionItems');
    host.replaceChildren();
    $('#selectionTotalLabel').textContent = '承認済み販売価格の小計';
    $('#selectionPriceNote').textContent = '保護された商品台帳と供給元承認済み価格表から取得した販売価格です。表示用の参考価格とは分離されています。';
    if (!lines.length) {
      const empty = element('div', {className:'empty-state'});
      empty.append(element('b', {text:'会員カートは空です。'}), element('p', {text:'商品を選択してから再度ご確認ください。'}));
      host.append(empty);
      $('#selectionTotal').textContent = '¥0';
      return;
    }

    let subtotal = 0;
    let allApproved = true;
    lines.forEach((item) => {
      const approved = isApprovedPriceSource(item.priceSource);
      allApproved = allApproved && approved;
      if (approved) subtotal += item.lineTotal || (item.unitPrice * item.quantity);
      const line = element('article', {className:'selection-line'});
      const copy = element('div');
      copy.append(
        element('b', {text:item.name}),
        element('small', {text:`${item.id} / 数量 ${item.quantity} / ${approved ? '承認済み販売価格' : '価格承認待ち'}`}),
      );
      line.append(copy, element('strong', {text:approved ? yen(item.lineTotal || item.unitPrice * item.quantity) : '販売価格未承認'}));
      host.append(line);
    });
    $('#selectionTotal').textContent = allApproved ? yen(subtotal) : `${subtotal ? `${yen(subtotal)} + ` : ''}販売価格未承認`;
  }

  function enhanceOrderModules() {
    const compact = window.matchMedia('(max-width: 760px)').matches;
    document.querySelectorAll('.function-module').forEach((module, index) => {
      const heading = module.querySelector('h3');
      const top = module.querySelector('.module-top');
      if (!heading || !top) return;
      const content = element('div', {className:'module-content'});
      content.id = `${module.id}-content`;
      let sibling = heading.nextSibling;
      while (sibling) {
        const next = sibling.nextSibling;
        content.append(sibling);
        sibling = next;
      }
      module.append(content);
      const disclosure = element('button', {className:'module-disclosure', type:'button'});
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
      if (!target?.classList?.contains('function-module')) return;
      const disclosure = target.querySelector('.module-disclosure');
      target.classList.remove('is-collapsed');
      disclosure?.setAttribute('aria-expanded', 'true');
      if (disclosure) disclosure.textContent = '閉じる';
    };
    document.querySelector('.function-rail')?.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const target = document.querySelector(link.getAttribute('href'));
      if (!target?.classList?.contains('function-module')) return;
      target.classList.remove('is-collapsed');
      const disclosure = target.querySelector('.module-disclosure');
      disclosure?.setAttribute('aria-expanded', 'true');
      if (disclosure) disclosure.textContent = '閉じる';
    });
    revealHashTarget();
    window.addEventListener('hashchange', revealHashTarget);
  }

  function renderModuleStates() {
    const activated = live().isActivated(liveCapabilities);
    const moduleMap = {
      memberModule:{internal:'memberAuth'}, ageModule:{provider:'ekyc'}, inventoryModule:{internal:'inventory'},
      deliveryModule:{provider:'carrier'}, paymentModule:{provider:'payment'}, orderModule:{internal:'orders'},
      notificationModule:{internal:'outbox', provider:'email'}, trackingModule:{provider:'carrier'},
    };
    Object.entries(moduleMap).forEach(([id, requirement]) => {
      const card = document.getElementById(id);
      const internalReady = !requirement.internal || liveCapabilities.modules?.[requirement.internal] === 'ready';
      const externalReady = !requirement.provider || live().providerReady(liveCapabilities, requirement.provider);
      card.dataset.runtime = activated && internalReady && externalReady ? 'active' : internalReady ? 'ready' : 'blocked';
      card.querySelector('.module-state').textContent = activated && internalReady && externalReady ? '稼働中' : internalReady ? '内部準備完了' : '内部確認が必要';
      const status = card.querySelector('.module-unavailable');
      status.replaceChildren(
        document.createTextNode(internalReady ? '内部コア：準備完了' : '内部コア：確認が必要'),
        document.createElement('br'),
        element('span', {text:externalReady ? (activated ? '外部接続：稼働中' : '外部接続：準備完了・総合スイッチ待ち') : '外部接続：契約情報待ち'}),
      );
    });
  }

  function renderReadiness(payload) {
    const host = $('#activationBlockers');
    const missing = Array.isArray(payload?.missing) ? payload.missing : [];
    if (payload?.ready === true && payload?.activated === true) {
      host.replaceChildren(element('li', {text:'サーバーの本番開始条件はすべて確認済みです。'}));
      return;
    }
    const labels = {
      ACTIVATION_DISABLED:'総合販売スイッチ（未アクティブ）',
      LICENSED_PREMISE_NOT_CONFIGURED:'通信販売許可・許可営業所ID',
      LICENSED_PREMISE_ACCEPTANCE_UNVERIFIED:'通信販売許可・許可営業所の本番受入証跡',
      PAYMENT_WEBHOOK_NOT_CONFIGURED:'決済Webhook署名設定',
      SHIPPING_RATES_NOT_CONFIGURED:'承認済み配送サービス・運賃表',
      SHIPPING_RATE_ACCEPTANCE_UNVERIFIED:'配送サービス・運賃表の本番受入証跡',
      DEPLOYMENT_SECURITY_NOT_CONFIGURED:'クラウド配備の暗号化・バックアップ・監視・アクセス制御',
      DEPLOYMENT_SECURITY_EVIDENCE_STALE:'クラウド配備の復旧試験証跡（更新が必要）',
      DEPLOYMENT_SECURITY_ACCEPTANCE_UNVERIFIED:'クラウド配備セキュリティの本番受入証跡',
      MERCHANT_PUBLICATION_NOT_CONFIGURED:'公開経営情報・許認可・規約',
      MERCHANT_PUBLICATION_ACCEPTANCE_UNVERIFIED:'公開経営情報・規約の本番受入証跡',
      ADMIN_IDENTITY_NOT_CONFIGURED:'管理者SSO・受信プロキシ認証',
      EKYC_NOT_CONFIGURED:'eKYC事業者の契約情報',
      EKYC_ACCEPTANCE_UNVERIFIED:'eKYC事業者の本番受入証跡',
      PAYMENT_NOT_CONFIGURED:'決済事業者の契約情報',
      PAYMENT_ACCEPTANCE_UNVERIFIED:'決済事業者の本番受入証跡',
      CARRIER_NOT_CONFIGURED:'配送事業者の契約情報',
      CARRIER_ACCEPTANCE_UNVERIFIED:'配送事業者の本番受入証跡',
      EMAIL_NOT_CONFIGURED:'通知メール事業者の契約情報',
      EMAIL_ACCEPTANCE_UNVERIFIED:'通知メール事業者の本番受入証跡',
    };
    const licenseMissing = missing.some((item) => item?.code === 'LICENSED_PREMISE_NOT_CONFIGURED');
    const baseline = [
      licenseMissing ? null : '通信販売許可・許可営業所ID：API設定済み',
      '供給元審査・承認済み販売価格表：商品ごとに確認',
      'クラウド配備セキュリティ・公開経営情報：本番受入を確認',
      '本番受入試験',
    ].filter(Boolean);
    host.replaceChildren();
    [...missing.map((item) => labels[item?.code] || item?.label || item?.code || item), ...baseline]
      .forEach((item) => host.append(element('li', {text:String(item)})));
  }

  function renderOrderSummary(payload) {
    const host = $('#liveOrderSummary');
    const orders = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload?.items) ? payload.items : [];
    if (!orders.length) return;
    host.hidden = false;
    host.textContent = `保護された注文台帳：${orders.length}件。詳細は会員・注文ページで確認できます。`;
  }

  function safeProviderLink(payload) {
    const action = payload?.payment?.clientAction;
    const candidate = payload?.nextAction?.url || payload?.redirectUrl || (typeof action === 'string' ? action : action?.url);
    if (!candidate) return null;
    try { const url = new URL(candidate); return url.protocol === 'https:' ? url.href : null; }
    catch { return null; }
  }

  function renderActivatedCheckout() {
    const host = $('#checkoutActivationHost');
    host.replaceChildren();
    if (!live().isActivated(liveCapabilities)) return;
    if (!liveSession.authenticated) {
      const card = element('section', {className:'checkout-live-form'});
      card.append(element('h3', {text:'会員ログインが必要です。'}), element('p', {text:'注文手続きは保護された会員セッションでのみ開始できます。'}));
      const link = element('a', {className:'outline-button', text:'会員ページへ'});
      link.href = './account.html';
      card.append(link);
      host.append(card);
      return;
    }

    const localLines = commerce().readCart();
    if (normalizeServerLines(liveCartPayload).length === 0) {
      if (!localLines.length) {
        host.append(element('div', {className:'checkout-live-result', text:'会員カートは空です。商品案内から商品を選択してください。'}));
        return;
      }
      const transfer = element('section', {className:'checkout-live-form'});
      transfer.append(
        element('h3', {text:'選択リストを会員カートへ反映'}),
        element('p', {text:'この端末で選んだ商品と数量を、保護された会員カートに保存します。販売価格と在庫はサーバー側で再確認します。'}),
      );
      const transferButton = element('button', {type:'button', text:'会員カートへ反映する'});
      const transferResult = element('div', {className:'checkout-live-result'});
      transferButton.addEventListener('click', async () => {
        transferButton.disabled = true;
        transferResult.textContent = '会員カートへ保存しています。';
        try {
          for (const line of localLines) await live().setCartItem(line.id, line.quantity);
          liveCartPayload = await live().cart();
          renderServerSelection(liveCartPayload);
          renderActivatedCheckout();
        } catch {
          transferResult.textContent = '会員カートへ反映できませんでした。商品状態とセッションをご確認ください。';
          transferButton.disabled = false;
        }
      });
      transfer.append(transferButton, transferResult);
      host.append(transfer);
      return;
    }

    const options = liveCheckoutOptions;
    const services = options?.services || [];
    const policy = options?.deliveryPolicy;
    const subtotal = approvedCartSubtotal(liveCartPayload);
    if (!services.length || !policy) {
      host.append(element('div', {className:'checkout-live-result', text:'承認済みの配送サービス・運賃表と受取条件を確認できないため、注文入力を停止しています。'}));
      return;
    }
    if (!policy.faceToFaceDelivery || !policy.ageVerificationRequired || policy.leaveAtDoorAllowed) {
      host.append(element('div', {className:'checkout-live-result', text:'対面受取・受取時年齢確認・置き配禁止の条件が揃っていないため、注文入力を停止しています。'}));
      return;
    }
    if (subtotal == null) {
      host.append(element('div', {className:'checkout-live-result', text:'会員カート内の全商品について承認済み販売価格を確認できないため、注文入力を停止しています。'}));
      return;
    }

    const form = element('form', {className:'checkout-live-form'});
    form.noValidate = true;
    form.append(element('h3', {text:'配送先と注文内容の確認'}), element('p', {text:'入力内容は保護された注文APIへ送信され、まず在庫予約付きのDRAFT注文として保存されます。決済や配送を模擬完了させることはありません。'}));
    const fields = element('div', {className:'checkout-live-fields'});
    const definitions = [
      ['recipientName','text','受取人氏名','name'], ['phone','tel','電話番号','tel'], ['postalCode','text','郵便番号','postal-code'],
      ['prefecture','text','都道府県','address-level1'], ['addressLine','text','市区町村・番地・建物名','street-address'],
    ];
    const inputs = {};
    definitions.forEach(([name, type, labelText, autocomplete]) => {
      const label = element('label', {text:labelText});
      if (name === 'addressLine') label.className = 'full-width';
      const input = element('input', {type});
      input.name = name;
      input.autocomplete = autocomplete;
      input.required = true;
      inputs[name] = input;
      label.append(input);
      fields.append(label);
    });
    const carrierLabel = element('label', {text:'配送サービス'});
    const carrier = element('select');
    carrier.name = 'carrierService';
    carrier.required = true;
    services.forEach((service) => {
      const threshold = service.freeShippingThresholdJpy == null ? '' : `（${yen(service.freeShippingThresholdJpy)}以上は送料無料）`;
      const option = element('option', {text:`${service.label} / ${yen(service.feeJpy)}${threshold}`});
      option.value = service.id;
      carrier.append(option);
    });
    carrierLabel.append(carrier);
    const dateLabel = element('label', {text:'指定配達日'});
    const deliveryDate = element('select');
    deliveryDate.name = 'deliveryDate';
    deliveryDate.required = true;
    deliveryDates(policy).forEach((date) => {
      const option = element('option', {text:date.label});
      option.value = date.value;
      deliveryDate.append(option);
    });
    dateLabel.append(deliveryDate);
    const timeLabel = element('label', {text:'指定時間帯'});
    const timeSlot = element('select');
    timeSlot.name = 'timeSlot';
    timeSlot.required = true;
    policy.timeSlots.forEach((slot) => {
      const option = element('option', {text:slot.label});
      option.value = slot.id;
      timeSlot.append(option);
    });
    timeLabel.append(timeSlot);
    fields.append(carrierLabel, dateLabel, timeLabel);

    const compliance = element('aside', {className:'checkout-compliance'});
    compliance.setAttribute('role', 'note');
    compliance.append(element('b', {text:'たばこ配送の受取条件'}));
    const complianceList = element('ul');
    ['対面受取', '受取時年齢確認要', '置き配不可'].forEach((item) => complianceList.append(element('li', {text:item})));
    compliance.append(complianceList);

    const totals = element('section', {className:'checkout-total-summary'});
    totals.setAttribute('aria-live', 'polite');
    const subtotalValue = element('strong');
    const shippingValue = element('strong');
    const grandTotalValue = element('strong');
    const shippingRule = element('small');
    const totalRow = (label, value, className = '') => {
      const row = element('div', {className});
      row.append(element('span', {text:label}), value);
      return row;
    };
    totals.append(
      totalRow('承認済み商品小計', subtotalValue),
      totalRow('配送料', shippingValue),
      totalRow('お支払い予定額', grandTotalValue, 'grand-total'),
      shippingRule,
    );
    const updateTotals = () => {
      const service = services.find((item) => item.id === carrier.value);
      if (!service) return;
      const fee = shippingFee(service, subtotal);
      subtotalValue.textContent = yen(subtotal);
      shippingValue.textContent = fee === 0 ? '送料無料' : yen(fee);
      grandTotalValue.textContent = yen(subtotal + fee);
      shippingRule.textContent = service.freeShippingThresholdJpy == null
        ? `${service.label}の承認済み配送料を適用しています。`
        : `${service.label}は商品小計${yen(service.freeShippingThresholdJpy)}以上で送料無料です。`;
    };
    carrier.addEventListener('change', updateTotals);
    updateTotals();

    const submit = element('button', {type:'submit', text:'在庫と承認価格を確認してDRAFT注文を作成'});
    const result = element('div', {className:'checkout-live-result'});
    form.append(fields, compliance, totals, submit, result);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || !live().isActivated(liveCapabilities)) return;
      submit.disabled = true;
      result.textContent = '保護されたサーバーで在庫・承認価格を確認しています。';
      try {
        const draft = await live().createDraftOrder({
          recipientName:inputs.recipientName.value, phone:inputs.phone.value, postalCode:inputs.postalCode.value,
          prefecture:inputs.prefecture.value, addressLine:inputs.addressLine.value,
        }, carrier.value, deliveryDate.value, timeSlot.value);
        const persistedOrder = draft.order || draft;
        const orderId = persistedOrder.id || persistedOrder.orderId;
        result.replaceChildren(element('b', {text:`DRAFT注文 ${orderId || '保存済み'}`}), element('p', {text:`状態：${persistedOrder.status || 'DRAFT'}。外部処理はまだ開始していません。`}));
        if (orderId) {
          const activate = element('button', {type:'button', text:'eKYC・決済手続きを開始'});
          const activationStatus = element('p', {className:'checkout-processing-status'});
          activate.addEventListener('click', async () => {
            activate.disabled = true;
            activate.textContent = 'eKYC 年齢確認処理中...';
            activationStatus.textContent = '本人確認事業者の応答を待っています。確認完了を確約する表示ではありません。';
            try {
              const response = await live().activateOrder(orderId);
              activate.textContent = '決済処理状況を確認中...';
              activationStatus.textContent = 'eKYCの応答を受領し、決済事業者の受付状態を確認しています。決済完了を確約する表示ではありません。';
              await new Promise((resolve) => requestAnimationFrame(resolve));
              const providerUrl = safeProviderLink(response);
              result.append(element('p', {text:`注文状態：${response.order?.status || '処理受付済み'}`}));
              if (providerUrl) {
                const link = element('a', {className:'outline-button', text:'本人確認・決済事業者へ進む'});
                link.href = providerUrl;
                link.rel = 'noopener noreferrer';
                result.append(link);
              }
              activationStatus.textContent = providerUrl
                ? '事業者の画面で本人確認・決済手続きを続けてください。完了状態は事業者の確定応答後に注文履歴へ反映されます。'
                : '外部処理を受け付けました。完了状態は事業者の確定応答後に注文履歴へ反映されます。';
              activate.textContent = '注文状態を再確認する';
            } catch (error) {
              const missingItems = Array.isArray(error.payload?.details?.missing)
                ? error.payload.details.missing
                : Array.isArray(error.payload?.missing) ? error.payload.missing : [];
              const missing = missingItems.length
                ? ` 不足：${missingItems.map((item) => item?.label || item?.code || String(item)).join('、')}`
                : '';
              activationStatus.textContent = `外部処理は開始されませんでした。${missing}`;
              activate.textContent = 'eKYC・決済手続きを再試行';
            } finally { activate.disabled = false; }
          });
          result.append(activate, activationStatus);
        }
      } catch (error) {
        result.textContent = error.payload?.message || 'DRAFT注文を作成できませんでした。在庫・価格・入力内容をご確認ください。';
      } finally { submit.disabled = false; }
    });
    host.append(form);
  }

  function failClosed(copy) {
    const notice = $('#commerceRuntimeNotice');
    notice.dataset.state = 'locked';
    notice.querySelector('strong').textContent = '内部コア構築済み・販売開始前';
    notice.querySelector('span').textContent = copy;
    $('#checkoutActivationHost').replaceChildren();
  }

  async function initializeLiveCommerce() {
    if (!live()?.configured) {
      failClosed('公開環境の保護された commerce API は未設定です。外部契約と本番受入が完了するまで、個人情報・本人確認書類・決済情報を受け付けません。');
      return;
    }
    try {
      liveCapabilities = await live().capabilities();
      $('#cartRuntimeStatus').textContent = liveCapabilities.modules?.cart === 'ready'
        ? '端末内カート：利用可能 / 保護された会員カートAPI：内部準備完了'
        : '端末内カート：利用可能 / 会員カートAPI：内部確認が必要';
      renderModuleStates();
      try { renderReadiness(await live().activationReadiness()); } catch { /* Static blockers remain visible. */ }
      try { liveSession = await live().session(); } catch { liveSession = {authenticated:false}; }
      if (liveSession.authenticated) {
        try {
          liveCartPayload = await live().cart();
          if (normalizeServerLines(liveCartPayload).length) renderServerSelection(liveCartPayload);
        } catch { /* Keep the local reference selection. */ }
        try { renderOrderSummary(await live().orders()); } catch { /* No history is displayed without an authenticated response. */ }
      }
      const activated = live().isActivated(liveCapabilities);
      liveCheckoutOptions = null;
      if (activated && liveSession.authenticated) {
        try { liveCheckoutOptions = normalizeCheckoutOptions(await live().checkoutOptions()); }
        catch { /* Missing or invalid options keep the checkout form fail-closed. */ }
      }
      const notice = $('#commerceRuntimeNotice');
      notice.dataset.state = activated ? 'active' : 'locked';
      notice.querySelector('strong').textContent = activated ? 'オンライン販売サービス稼働中' : '内部コア構築済み・外部契約待ち';
      notice.querySelector('span').textContent = activated
        ? '保護された内部APIと外部事業者の接続が確認されています。'
        : '内部APIは応答していますが、外部契約または本番受入が未完了のため総合販売スイッチは無効です。';
      renderActivatedCheckout();
    } catch {
      failClosed('内部APIに接続できないため、販売処理とすべての敏感情報入力を停止しています。');
    }
  }

  async function init() {
    if (!commerce()) {
      console.error('KISARAGI commerce configuration failed to load');
      return;
    }
    renderLocalSelection();
    enhanceOrderModules();
    await initializeLiveCommerce();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
