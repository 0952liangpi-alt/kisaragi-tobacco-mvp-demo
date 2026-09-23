(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const client = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const yen = (amount) => `¥${Number(amount).toLocaleString('ja-JP')}`;
  let capabilities = null;
  let session = {authenticated:false};

  function element(tag, {className, text, type} = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    if (type) node.type = type;
    return node;
  }

  function setServiceState(state, title, copy) {
    $('#serviceStatus').dataset.state = state;
    $('#serviceStatusTitle').textContent = title;
    $('#serviceStatusCopy').textContent = copy;
  }

  function setLayer(selector, state, title) {
    const layer = $(selector);
    layer.dataset.state = state;
    layer.querySelector('b').textContent = title;
  }

  function renderProviders(documentData) {
    for (const providerId of ['ekyc', 'payment', 'carrier', 'email']) {
      const card = document.querySelector(`[data-provider="${providerId}"]`);
      const provider = documentData?.providers?.[providerId];
      const ready = client().providerReady(documentData, providerId);
      card.dataset.state = ready ? 'ready' : 'missing';
      card.querySelector('b').textContent = ready
        ? '本番受入確認済み'
        : provider?.configured
          ? '接続済み・受入証跡待ち'
          : '契約情報待ち';
    }
  }

  function renderBlockers(readiness) {
    const host = $('#activationBlockers');
    const missing = Array.isArray(readiness?.missing) ? readiness.missing : [];
    if (readiness?.ready === true && readiness?.activated === true) {
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
    const licenseMissing = missing.some((blocker) => blocker?.code === 'LICENSED_PREMISE_NOT_CONFIGURED');
    const baseline = [
      licenseMissing ? null : '通信販売許可・許可営業所ID：API設定済み',
      '供給元審査・承認済み販売価格表：商品ごとに確認',
      'クラウド配備セキュリティ・公開経営情報：本番受入を確認',
      '本番受入試験',
    ].filter(Boolean);
    host.replaceChildren();
    [...missing.map((blocker) => labels[blocker?.code] || blocker?.label || blocker?.code || blocker), ...baseline]
      .forEach((blocker) => host.append(element('li', {text:String(blocker)})));
  }

  function renderSession() {
    const host = $('#sessionContent');
    host.replaceChildren();
    if (!session.authenticated) {
      $('#sessionChip').textContent = capabilities ? '未ログイン' : '利用停止';
      host.append(element('p', {text:capabilities
        ? '保護された会員セッションは開始されていません。'
        : '保護されたAPIが未接続のため、会員情報は入力できません。'}));
      return;
    }

    $('#sessionChip').textContent = 'ログイン中';
    const list = element('dl');
    const rows = [
      ['会員ID', session.user?.id || '非公開'],
      ['メール', session.user?.email || '登録済み'],
      ['会員状態', session.user?.status || '確認中'],
    ];
    rows.forEach(([label, value]) => {
      const row = element('div');
      row.append(element('dt', {text:label}), element('dd', {text:value}));
      list.append(row);
    });
    host.append(list);
  }

  function safeTrackingLink(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendDetailRow(list, label, value) {
    if (value == null || value === '') return;
    const row = element('div');
    row.append(element('dt', {text:label}), element('dd', {text:String(value)}));
    list.append(row);
  }

  function renderOrderDetail(payload, host) {
    const order = payload?.order || payload;
    host.replaceChildren();
    if (!order || typeof order !== 'object') {
      host.append(element('p', {className:'form-message', text:'注文詳細を確認できませんでした。'}));
      return;
    }

    const reference = order.publicReference || order.publicOrderReference || order.reference;
    const preference = order.deliveryPreference || {};
    const shipment = order.shipment || null;
    const detailList = element('dl', {className:'order-detail-list'});
    appendDetailRow(detailList, '注文参照番号', reference || '発行待ち');
    appendDetailRow(detailList, '注文状態', order.status || '確認中');
    appendDetailRow(detailList, '商品小計', Number.isInteger(order.totals?.subtotalJpy) ? yen(order.totals.subtotalJpy) : null);
    appendDetailRow(detailList, '配送料', Number.isInteger(order.totals?.shippingJpy) ? yen(order.totals.shippingJpy) : null);
    appendDetailRow(detailList, '合計', Number.isInteger(order.totals?.totalJpy) ? yen(order.totals.totalJpy) : null);
    appendDetailRow(detailList, '配送サービス', order.carrierService || shipment?.serviceCode || shipment?.provider);
    appendDetailRow(detailList, '指定配達日', preference.deliveryDate);
    appendDetailRow(detailList, '指定時間帯', preference.timeSlotLabel || preference.timeSlot);
    appendDetailRow(detailList, '受取方法', preference.faceToFaceDelivery === true ? '対面受取' : null);
    appendDetailRow(detailList, '年齢確認', preference.ageVerificationRequired === true ? '受取時年齢確認要' : null);
    appendDetailRow(detailList, '置き配', preference.leaveAtDoorAllowed === false ? '置き配不可' : null);
    if (shipment) {
      appendDetailRow(detailList, '配送状態', shipment.status || '確認中');
      appendDetailRow(detailList, '追跡番号', shipment.trackingNumber);
    }
    host.append(detailList);

    const trackingUrl = safeTrackingLink(shipment?.trackingUrl);
    if (trackingUrl) {
      const link = element('a', {className:'order-tracking-link', text:'配送事業者の追跡ページを開く'});
      link.href = trackingUrl;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      host.append(link);
    }

    const events = Array.isArray(shipment?.events) ? shipment.events : [];
    const timelineTitle = element('h4', {text:'配送履歴'});
    host.append(timelineTitle);
    if (!events.length) {
      host.append(element('p', {className:'form-message', text:shipment ? '配送事業者から確定した追跡イベントはまだありません。' : '出荷後に配送事業者の確定した追跡情報を表示します。'}));
      return;
    }
    const timeline = element('ol', {className:'order-timeline'});
    events.forEach((event) => {
      const item = element('li');
      const time = event.occurredAt || event.time;
      const summary = [event.status, event.location].filter(Boolean).join(' / ');
      if (time) item.append(element('time', {text:String(time)}));
      if (summary) item.append(element('b', {text:summary}));
      if (event.detail) item.append(element('span', {text:String(event.detail)}));
      timeline.append(item);
    });
    host.append(timeline);
  }

  function addOrderDetailAction(order, row, actions) {
    const id = order.id || order.orderId;
    if (!id) return;
    const detailId = `order-detail-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const detail = element('section', {className:'order-detail'});
    detail.id = detailId;
    detail.hidden = true;
    const button = element('button', {type:'button', text:'詳細を見る'});
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', detailId);
    let loaded = false;
    button.addEventListener('click', async () => {
      const opening = detail.hidden;
      detail.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      button.textContent = opening ? '詳細を閉じる' : '詳細を見る';
      if (!opening || loaded) return;
      button.disabled = true;
      detail.replaceChildren(element('p', {className:'form-message', text:'保護された注文台帳から詳細を読み込んでいます。'}));
      try {
        renderOrderDetail(await client().order(id), detail);
        loaded = true;
      } catch {
        detail.replaceChildren(element('p', {className:'form-message', text:'注文詳細を読み込めませんでした。セッションと通信状態をご確認ください。'}));
      } finally {
        button.disabled = false;
      }
    });
    actions.append(button);
    row.append(detail);
  }

  function renderOrders(payload) {
    const host = $('#orderHistory');
    host.replaceChildren();
    const orders = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload?.items) ? payload.items : [];
    if (!orders.length) {
      $('#ordersChip').textContent = session.authenticated ? '0件' : 'ログイン後';
      host.append(element('p', {text:session.authenticated ? '保存された注文はありません。' : '注文履歴はログイン後に表示します。'}));
      return;
    }

    $('#ordersChip').textContent = `${orders.length}件`;
    orders.forEach((order) => {
      const row = element('article', {className:'order-row'});
      const copy = element('div');
      const reference = order.publicReference || order.publicOrderReference || order.reference;
      copy.append(
        element('b', {text:reference || order.id || order.orderId || '注文参照番号は発行待ち'}),
        element('small', {text:`状態：${order.status || '確認中'}`}),
      );
      const total = Number(order.totals?.totalJpy ?? order.totals?.grandTotal ?? order.total ?? 0);
      const actions = element('div', {className:'order-actions'});
      actions.append(element('strong', {text:total ? `¥${total.toLocaleString('ja-JP')}` : '金額確認中'}));
      if (order.status === 'PAYMENT_FAILED' && order.paymentReviewRequired !== true && client().isActivated(capabilities)) {
        const retry = element('button', {type:'button', text:'決済を再試行'});
        const feedback = element('small', {className:'form-message'});
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          feedback.textContent = '決済事業者へ再試行を要求しています。';
          try {
            await client().retryPayment(order.id || order.orderId);
            feedback.textContent = '再試行を受け付けました。決済事業者の応答を待っています。';
            await refreshSession();
          } catch (error) {
            feedback.textContent = error.code === 'PAYMENT_REVIEW_REQUIRED'
              ? '決済照合が必要です。運営者へお問い合わせください。'
              : '決済を再試行できませんでした。状態を再確認してください。';
            retry.disabled = false;
          }
        });
        actions.append(retry, feedback);
      }
      row.append(copy, actions);
      addOrderDetailAction(order, row, actions);
      host.append(row);
    });
  }

  function createAuthForm(mode) {
    const form = element('form', {className:'auth-form'});
    form.noValidate = true;
    const emailLabel = element('label', {text:'メールアドレス'});
    const email = element('input', {type:'email'});
    email.name = 'email';
    email.autocomplete = 'email';
    email.required = true;
    emailLabel.append(email);
    const passwordLabel = element('label', {text:'パスワード'});
    const password = element('input', {type:'password'});
    password.name = 'password';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    password.minLength = 12;
    password.required = true;
    passwordLabel.append(password);
    const submit = element('button', {type:'submit', text:mode === 'register' ? '会員登録' : 'ログイン'});
    const message = element('p', {className:'form-message'});
    form.append(emailLabel, passwordLabel, submit, message);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const registrationAllowed = mode === 'register' && client().isActivated(capabilities);
      const loginAllowed = mode === 'login' && Boolean(capabilities);
      if (!registrationAllowed && !loginAllowed) return;
      submit.disabled = true;
      message.textContent = '保護された接続で処理しています。';
      try {
        await (mode === 'register' ? client().register(email.value, password.value) : client().login(email.value, password.value));
        await refreshSession();
      } catch (error) {
        message.textContent = error.status === 401 ? 'メールアドレスまたはパスワードを確認してください。' : '手続きを完了できませんでした。';
      } finally {
        submit.disabled = false;
      }
    });
    return form;
  }

  function renderActions() {
    const host = $('#authActions');
    host.replaceChildren();
    if (session.authenticated) {
      const logout = element('button', {className:'logout-button', type:'button', text:'ログアウト'});
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        try { await client().logout(); } finally { await refreshSession(); }
      });
      host.append(logout);
      return;
    }
    if (!capabilities) {
      host.append(element('p', {className:'form-message', text:'外部契約と販売開始の確認が完了するまで、登録・ログイン入力は無効です。'}));
      return;
    }

    const tabs = element('div', {className:'auth-tabs'});
    const loginTab = element('button', {type:'button', text:'ログイン'});
    const registerTab = client().isActivated(capabilities)
      ? element('button', {type:'button', text:'会員登録'})
      : null;
    const formHost = element('div');
    const select = (mode) => {
      loginTab.setAttribute('aria-pressed', String(mode === 'login'));
      registerTab?.setAttribute('aria-pressed', String(mode === 'register'));
      formHost.replaceChildren(createAuthForm(mode));
    };
    loginTab.addEventListener('click', () => select('login'));
    registerTab?.addEventListener('click', () => select('register'));
    tabs.append(loginTab);
    if (registerTab) tabs.append(registerTab);
    host.append(tabs, formHost);
    if (!registerTab) {
      host.append(element('p', {className:'form-message', text:'新規登録と新規販売は停止中です。既存会員はログインして注文履歴を確認できます。'}));
    }
    select('login');
  }

  async function refreshSession() {
    try {
      session = await client().session();
    } catch {
      session = {authenticated:false};
    }
    renderSession();
    renderActions();
    if (!session.authenticated) {
      renderOrders([]);
      return;
    }
    try { renderOrders(await client().orders()); }
    catch { renderOrders([]); }
  }

  function failClosed(message) {
    capabilities = null;
    setServiceState('offline', '外部契約待ち・販売開始前', message);
    setLayer('#internalLayer', 'waiting', '構築済み・公開API未接続');
    setLayer('#providerLayer', 'waiting', '外部契約待ち');
    setLayer('#activationLayer', 'locked', '未アクティブ');
    document.querySelectorAll('[data-provider]').forEach((card) => {
      card.dataset.state = 'missing';
      card.querySelector('b').textContent = '契約情報待ち';
    });
    renderSession();
    renderOrders([]);
    renderActions();
  }

  async function init() {
    if (!client()?.configured) {
      failClosed('公開環境の保護された commerce API は未設定です。個人情報を受け付けません。');
      return;
    }
    try {
      capabilities = await client().capabilities();
      const activated = client().isActivated(capabilities);
      const internalReady = ['memberAuth', 'cart', 'inventory', 'orders', 'outbox', 'audit']
        .every((id) => capabilities.modules?.[id] === 'ready');
      setLayer('#internalLayer', internalReady ? 'ready' : 'waiting', internalReady ? '内部コア構築済み' : '内部確認が必要');
      setLayer('#providerLayer', activated ? 'ready' : 'waiting', activated ? '外部接続準備完了' : '外部契約待ち');
      setLayer('#activationLayer', activated ? 'ready' : 'locked', activated ? 'アクティブ' : '未アクティブ');
      setServiceState(activated ? 'ready' : 'checking', activated ? 'オンライン販売サービス：稼働中' : '内部コア構築済み・外部契約待ち', activated
        ? 'サーバーが全プロバイダーの接続と販売開始を確認しました。'
        : '内部APIは応答していますが、総合販売スイッチは有効になっていません。');
      renderProviders(capabilities);
      try { renderBlockers(await client().activationReadiness()); } catch { /* Capability state remains fail-closed. */ }
      await refreshSession();
    } catch {
      failClosed('内部APIに接続できません。入力と販売処理を停止しています。');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
