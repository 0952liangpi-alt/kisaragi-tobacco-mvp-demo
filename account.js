(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const client = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const yen = (amount) => `¥${Number(amount).toLocaleString('ja-JP')}`;
  const orderStatusLabel = (status) => ({
    DRAFT:'仮注文保存済み', PENDING:'処理中', PENDING_PROVIDER:'手続き待ち',
    AGE_VERIFICATION_PENDING:'年齢・本人確認待ち', AGE_VERIFIED:'年齢確認済み',
    AGE_VERIFICATION_FAILED:'年齢・本人確認未完了',
    AWAITING_PAYMENT:'お支払い待ち', PAYMENT_PENDING:'お支払い確認中', PAYMENT_FAILED:'お支払い未完了',
    PAYMENT_REVIEW_REQUIRED:'お支払い確認中', PAID:'お支払い済み', FULFILLMENT_PENDING:'出荷準備中',
    READY_TO_SHIP:'出荷準備完了', SHIPPED:'発送済み', IN_TRANSIT:'配送中', DELIVERED:'配達済み',
    CANCELLATION_IN_PROGRESS:'取消処理中', CANCELLED:'取消済み',
    REFUND_PENDING:'返金処理中', REFUND_IN_PROGRESS:'返金処理中', REFUNDED:'返金済み',
  })[String(status || '').toUpperCase()] || '確認中';
  const memberStatusLabel = (status) => ({
    ACTIVE:'利用中', VERIFIED:'確認済み', PENDING:'確認待ち', PENDING_VERIFICATION:'本人確認待ち',
    SUSPENDED:'利用停止中', LOCKED:'一時停止中', CLOSED:'退会済み',
  })[String(status || '').toUpperCase()] || '確認中';
  const shipmentStatusLabel = (status) => ({
    PENDING:'出荷準備中', LABEL_CREATED:'送り状作成済み', READY_TO_SHIP:'出荷準備完了',
    SHIPPED:'発送済み', ACCEPTED:'受付済み', IN_TRANSIT:'配送中', OUT_FOR_DELIVERY:'配達中',
    DELIVERED:'配達済み', DELIVERY_FAILED:'持ち戻り', RETURNED:'返送済み', CANCELLED:'取消済み',
  })[String(status || '').toUpperCase()] || '確認中';

  let capabilities = null;
  let session = {authenticated:false};
  let sessionReachable = false;
  let refreshGeneration = 0;
  let externalRefreshPromise = null;

  function element(tag, {className, text, type} = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    if (type) node.type = type;
    return node;
  }

  function setAnnouncementState(node, error = false) {
    node.setAttribute('role', error ? 'alert' : 'status');
    node.setAttribute('aria-live', error ? 'assertive' : 'polite');
    node.setAttribute('aria-atomic', 'true');
  }

  function announce(node, message, error = false) {
    setAnnouncementState(node, error);
    node.textContent = message;
  }

  function ordersFrom(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.orders)) return payload.orders;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }

  function isServiceUnavailable(error) {
    return ['NOT_CONFIGURED', 'OFFLINE', 'TIMEOUT'].includes(error?.code) || Number(error?.status) >= 500;
  }

  function authAvailable(mode) {
    if (!capabilities || !sessionReachable) return false;
    return mode === 'login' || client()?.isActivated(capabilities) === true;
  }

  function authUnavailableText(mode) {
    if (!client()?.configured || !sessionReachable) {
      return '会員サービスに接続できません。時間をおいてから、もう一度お試しください。';
    }
    if (mode === 'register') {
      return 'オンライン会員登録は現在受付準備中です。受付開始後、この画面から登録できます。';
    }
    return '現在、この手続きをご利用いただけません。';
  }

  function renderSession() {
    const host = $('#sessionContent');
    host.replaceChildren();
    if (!session.authenticated) {
      $('#sessionChip').textContent = '未ログイン';
      host.append(element('p', {text:'ログインまたは会員登録を選択してください。'}));
      return;
    }

    $('#sessionChip').textContent = 'ログイン中';
    host.append(element('p', {text:session.user?.email
      ? `${session.user.email} でログインしています。`
      : '会員としてログインしています。'}));
  }

  function renderAgeVerification() {
    const host = $('#ageVerificationContent');
    host.replaceChildren();
    if (!session.authenticated) {
      $('#ageVerificationChip').textContent = 'ログイン後';
      host.append(element('p', {text:'年齢・本人確認は、ご注文ごとに注文履歴へ表示します。'}));
      return;
    }
    $('#ageVerificationChip').textContent = '注文ごと';
    host.append(element('p', {text:'年齢・本人確認は注文手続きの開始後に行い、結果は該当する注文の状態として注文履歴へ反映します。'}));
  }

  function renderMemberProfile() {
    const host = $('#memberProfileContent');
    host.replaceChildren();
    if (!session.authenticated) {
      $('#memberProfileChip').textContent = 'ログイン後';
      host.append(element('p', {text:'ログイン後に登録情報を表示します。'}));
      return;
    }

    $('#memberProfileChip').textContent = '表示中';
    const list = element('dl');
    [
      ['会員ID', session.user?.id || '非公開'],
      ['メール', session.user?.email || '登録済み'],
      ['会員状態', memberStatusLabel(session.user?.status)],
    ].forEach(([label, value]) => {
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

  function paymentResultLabel(payload) {
    const status = String(payload?.payment?.status || payload?.order?.payment?.status || payload?.status || payload?.order?.status || '').toUpperCase();
    return ({
      REQUIRES_ACTION:'追加の手続きが必要です。',
      PENDING:'決済処理中です。',
      PROCESSING:'決済処理中です。',
      PAYMENT_PENDING:'お支払い確認中です。',
      AGE_VERIFICATION_PENDING:'年齢・本人確認の完了待ちです。',
      AGE_VERIFIED:'年齢確認済みです。決済受付状態を確認しています。',
      AGE_VERIFICATION_FAILED:'年齢・本人確認を完了できませんでした。',
      SUCCEEDED:'お支払い済みです。',
      PAID:'お支払い済みです。',
      FAILED:'お支払いを完了できませんでした。',
      PAYMENT_FAILED:'お支払いを完了できませんでした。',
    })[status] || '最新の決済状況を注文詳細で確認してください。';
  }

  function appendDetailRow(list, label, value) {
    if (value == null || value === '') return;
    const row = element('div');
    row.append(element('dt', {text:label}), element('dd', {text:String(value)}));
    list.append(row);
  }

  function appendTracking(order, host) {
    const shipment = order?.shipment || null;
    const list = element('dl', {className:'order-detail-list'});
    appendDetailRow(list, '配送サービス', order?.carrierService || shipment?.serviceCode || shipment?.provider);
    appendDetailRow(list, '配送状態', shipment ? shipmentStatusLabel(shipment.status) : '出荷前');
    appendDetailRow(list, '追跡番号', shipment?.trackingNumber);
    host.append(list);

    const trackingUrl = safeTrackingLink(shipment?.trackingUrl);
    if (trackingUrl) {
      const link = element('a', {className:'order-tracking-link', text:'配送事業者の追跡ページを開く'});
      link.href = trackingUrl;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      host.append(link);
    }

    host.append(element('h4', {text:'配送履歴'}));
    const events = Array.isArray(shipment?.events) ? shipment.events : [];
    if (!events.length) {
      host.append(element('p', {className:'form-message', text:shipment
        ? '配送事業者から確定した追跡イベントはまだありません。'
        : '出荷後に配送事業者の確定した追跡情報を表示します。'}));
      return;
    }
    const timeline = element('ol', {className:'order-timeline'});
    events.forEach((event) => {
      const item = element('li');
      const time = event.occurredAt || event.time;
      const summary = [shipmentStatusLabel(event.status), event.location].filter(Boolean).join(' / ');
      if (time) item.append(element('time', {text:String(time)}));
      if (summary) item.append(element('b', {text:summary}));
      if (event.detail) item.append(element('span', {text:String(event.detail)}));
      timeline.append(item);
    });
    host.append(timeline);
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
    const list = element('dl', {className:'order-detail-list'});
    appendDetailRow(list, '注文参照番号', reference || '発行待ち');
    appendDetailRow(list, '注文状態', orderStatusLabel(order.status));
    appendDetailRow(list, '商品小計', Number.isInteger(order.totals?.subtotalJpy) ? yen(order.totals.subtotalJpy) : null);
    appendDetailRow(list, '配送料', Number.isInteger(order.totals?.shippingJpy) ? yen(order.totals.shippingJpy) : null);
    appendDetailRow(list, '合計', Number.isInteger(order.totals?.totalJpy) ? yen(order.totals.totalJpy) : null);
    appendDetailRow(list, '指定配達日', preference.deliveryDate);
    appendDetailRow(list, '指定時間帯', preference.timeSlotLabel || preference.timeSlot);
    appendDetailRow(list, '受取方法', preference.faceToFaceDelivery === true ? '対面受取' : null);
    appendDetailRow(list, '年齢確認', preference.ageVerificationRequired === true ? '受取時年齢確認要' : null);
    appendDetailRow(list, '置き配', preference.leaveAtDoorAllowed === false ? '置き配不可' : null);
    host.append(list);
    appendTracking(order, host);
  }

  function addOrderDetailAction(order, row, actions) {
    const id = order.id || order.orderId;
    if (!id) return;
    const detailId = `order-detail-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const detail = element('section', {className:'order-detail'});
    detail.id = detailId;
    detail.hidden = true;
    const detailStatus = element('p', {className:'form-message'});
    const detailContent = element('div');
    setAnnouncementState(detailStatus);
    detail.append(detailStatus, detailContent);
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
      announce(detailStatus, '注文詳細を読み込んでいます。');
      try {
        renderOrderDetail(await client().order(id), detailContent);
        loaded = true;
        announce(detailStatus, '注文詳細を読み込みました。');
      } catch (error) {
        detailContent.replaceChildren();
        announce(detailStatus, isServiceUnavailable(error) ? 'サービス未接続' : '注文詳細を読み込めませんでした。', true);
      } finally {
        button.disabled = false;
      }
    });
    actions.append(button);
    row.append(detail);
  }

  function renderOrders(payload) {
    const host = $('#orderHistory');
    const orders = ordersFrom(payload);
    setAnnouncementState(host);
    host.replaceChildren();
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
      const statusLine = element('small', {text:`状態：${orderStatusLabel(order.status)}`});
      copy.append(
        element('b', {text:reference || order.id || order.orderId || '注文参照番号は発行待ち'}),
        statusLine,
      );
      const total = Number(order.totals?.totalJpy ?? order.totals?.grandTotal ?? order.total ?? 0);
      const actions = element('div', {className:'order-actions'});
      actions.append(element('strong', {text:total ? yen(total) : '金額確認中'}));
      if (['DRAFT', 'AGE_VERIFICATION_PENDING', 'AGE_VERIFIED', 'PAYMENT_PENDING'].includes(order.status)) {
        const canActivate = client()?.isActivated(capabilities) === true;
        const continuation = element('button', {
          type:'button',
          text:order.status === 'DRAFT' ? '年齢確認・お支払いへ' : '手続き状況を確認',
        });
        continuation.disabled = !canActivate;
        const feedback = element('small', {className:canActivate ? 'form-message' : 'service-unavailable', text:canActivate ? '' : 'サービス未接続'});
        const providerActionHost = element('div', {className:'payment-provider-action'});
        setAnnouncementState(feedback);
        continuation.addEventListener('click', async () => {
          continuation.disabled = true;
          providerActionHost.replaceChildren();
          announce(feedback, order.status === 'DRAFT' ? '年齢確認とお支払いを開始しています。' : '最新の手続き状況を確認しています。');
          try {
            const id = order.id || order.orderId;
            const response = order.status === 'DRAFT' ? await client().activateOrder(id) : await client().order(id);
            const latestOrder = response?.order || response;
            const providerAction = safeProviderAction(response);
            if (latestOrder?.status) order.status = latestOrder.status;
            statusLine.textContent = `状態：${orderStatusLabel(latestOrder?.status)}`;
            announce(feedback, providerAction
              ? providerAction.kind === 'identity'
                ? '本人確認事業者で年齢・本人確認を続けてください。'
                : '決済事業者でお支払いを続けてください。'
              : paymentResultLabel(response));
            if (providerAction) {
              const link = element('a', {
                className:'payment-provider-link',
                text:providerAction.kind === 'identity' ? '本人確認事業者へ進む' : '決済事業者へ進む',
              });
              link.href = providerAction.url;
              link.rel = 'noopener noreferrer';
              providerActionHost.append(link);
            }
            continuation.textContent = '手続き状況を再確認';
          } catch (error) {
            announce(feedback, isServiceUnavailable(error) ? 'サービス未接続' : '手続きを続けられませんでした。時間をおいて再度お試しください。', true);
          } finally {
            continuation.disabled = !canActivate;
          }
        });
        actions.append(continuation, feedback, providerActionHost);
      }
      if (order.status === 'PAYMENT_FAILED' && order.paymentReviewRequired !== true) {
        const retryAvailable = client()?.isActivated(capabilities) === true;
        const retry = element('button', {type:'button', text:'決済を再試行'});
        retry.disabled = !retryAvailable;
        const feedback = element('small', {className:retryAvailable ? 'form-message' : 'service-unavailable', text:retryAvailable ? '' : 'サービス未接続'});
        const providerAction = element('div', {className:'payment-provider-action'});
        setAnnouncementState(feedback);
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          providerAction.replaceChildren();
          announce(feedback, '決済を再試行しています。');
          try {
            const response = await client().retryPayment(order.id || order.orderId);
            const externalAction = safeProviderAction(response);
            const providerUrl = externalAction?.kind === 'payment' ? externalAction.url : null;
            announce(feedback, providerUrl ? '決済事業者で手続きを続けてください。' : paymentResultLabel(response));
            if (providerUrl) {
              const link = element('a', {className:'payment-provider-link', text:'決済事業者へ進む'});
              link.href = providerUrl;
              link.rel = 'noopener noreferrer';
              providerAction.append(link);
            }
            const latestPayload = await client().order(order.id || order.orderId);
            const latestOrder = latestPayload?.order || latestPayload;
            statusLine.textContent = `状態：${orderStatusLabel(latestOrder?.status)}`;
            retry.textContent = '決済再試行を受付済み';
            retry.disabled = true;
          } catch (error) {
            announce(feedback, error.code === 'PAYMENT_REVIEW_REQUIRED'
              ? '決済状況の確認が必要です。お問い合わせください。'
              : isServiceUnavailable(error) ? 'サービス未接続' : '決済を再試行できませんでした。', true);
            retry.disabled = isServiceUnavailable(error) || !retryAvailable;
          }
        });
        actions.append(retry, feedback, providerAction);
      }
      row.append(copy, actions);
      addOrderDetailAction(order, row, actions);
      host.append(row);
    });
  }

  function renderTracking(payload) {
    const host = $('#trackingContent');
    const orders = ordersFrom(payload);
    setAnnouncementState(host);
    host.replaceChildren();
    if (!orders.length) {
      $('#trackingChip').textContent = session.authenticated ? '0件' : 'ログイン後';
      host.append(element('p', {text:session.authenticated ? '追跡できる注文はありません。' : 'ログイン後に注文ごとの配送状況を確認できます。'}));
      return;
    }

    $('#trackingChip').textContent = `${orders.length}件`;
    orders.forEach((order) => {
      const row = element('article', {className:'tracking-row'});
      const reference = order.publicReference || order.publicOrderReference || order.reference || order.id || order.orderId || '注文参照番号は発行待ち';
      const copy = element('div');
      copy.append(element('b', {text:reference}), element('small', {text:`注文状態：${orderStatusLabel(order.status)}`}));
      const action = element('div', {className:'tracking-action'});
      const button = element('button', {type:'button', text:'配送状況を見る'});
      const feedback = element('small', {className:'form-message'});
      const detail = element('section', {className:'order-detail'});
      detail.hidden = true;
      setAnnouncementState(feedback);
      button.addEventListener('click', async () => {
        const id = order.id || order.orderId;
        if (!id) return;
        button.disabled = true;
        detail.hidden = false;
        detail.replaceChildren();
        announce(feedback, '配送状況を読み込んでいます。');
        try {
          const payloadDetail = await client().order(id);
          const detailOrder = payloadDetail?.order || payloadDetail;
          appendTracking(detailOrder, detail);
          announce(feedback, '配送状況を読み込みました。');
        } catch (error) {
          detail.hidden = true;
          announce(feedback, isServiceUnavailable(error) ? 'サービス未接続' : '配送状況を読み込めませんでした。', true);
        } finally {
          button.disabled = false;
        }
      });
      action.append(button, feedback);
      row.append(copy, action, detail);
      host.append(row);
    });
  }

  function createAuthForm(mode) {
    const available = authAvailable(mode);
    const form = element('form', {className:'auth-form'});
    const messageId = `auth-${mode}-message`;
    const emailLabel = element('label', {text:'メールアドレス'});
    const email = element('input', {type:'email'});
    email.name = 'email';
    email.autocomplete = 'email';
    email.required = true;
    email.disabled = !available;
    email.setAttribute('aria-describedby', messageId);
    emailLabel.append(email);
    const passwordLabel = element('label', {text:'パスワード'});
    const password = element('input', {type:'password'});
    password.name = 'password';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    password.minLength = 12;
    password.required = true;
    password.disabled = !available;
    password.setAttribute('aria-describedby', messageId);
    passwordLabel.append(password);
    const submitRow = element('div', {className:'submit-row'});
    const submit = element('button', {type:'submit', text:mode === 'register' ? '会員登録' : 'ログイン'});
    submit.disabled = !available;
    const serviceState = element('span', {className:'service-unavailable', text:authUnavailableText(mode)});
    serviceState.hidden = available;
    submitRow.append(submit, serviceState);
    const message = element('p', {className:'form-message'});
    message.id = messageId;
    setAnnouncementState(message);
    form.append(emailLabel, passwordLabel, submitRow, message);
    form.addEventListener('invalid', (event) => {
      if (event.target !== form.querySelector(':invalid')) return;
      announce(message, 'メールアドレスと12文字以上のパスワードを入力してください。', true);
      event.target.focus();
    }, true);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!available || !form.checkValidity()) {
        const firstInvalid = form.querySelector(':invalid');
        if (available) {
          announce(message, 'メールアドレスと12文字以上のパスワードを入力してください。', true);
          firstInvalid?.focus();
          form.reportValidity();
        }
        return;
      }
      submit.disabled = true;
      announce(message, '保護された接続で処理しています。');
      try {
        await (mode === 'register' ? client().register(email.value, password.value) : client().login(email.value, password.value));
        await refreshSession();
      } catch (error) {
        if (isServiceUnavailable(error)) {
          sessionReachable = false;
          email.disabled = true;
          password.disabled = true;
          serviceState.textContent = authUnavailableText(mode);
          serviceState.hidden = false;
          message.textContent = '';
        } else {
          announce(message, error.status === 401 ? 'メールアドレスまたはパスワードを確認してください。' : '手続きを完了できませんでした。', true);
          (error.status === 401 ? email : form.querySelector(':invalid'))?.focus();
        }
      } finally {
        submit.disabled = !authAvailable(mode);
      }
    });
    return form;
  }

  function createPasswordResetForm(onReturnToLogin) {
    const localReset = capabilities?.environment === 'local';
    const linkedReset = !localReset && new URLSearchParams(globalThis.location?.search || '').get('mode') === 'reset';
    const resetState = new URLSearchParams(globalThis.location?.search || '').get('state');
    const requestAvailable = Boolean(
      client()?.configured && sessionReachable && capabilities?.operations?.passwordReset?.request?.ready === true &&
      typeof client().requestPasswordReset === 'function'
    );
    const confirmAvailable = Boolean(
      client()?.configured && sessionReachable && capabilities?.operations?.passwordReset?.confirm?.ready === true &&
      typeof client().confirmPasswordReset === 'function'
    );
    const available = requestAvailable || (linkedReset && confirmAvailable);
    const section = element('section', {className:'password-reset-panel'});
    section.append(
      element('h3', {text:'パスワードを再設定'}),
      element('p', {className:'password-reset-intro', text: localReset
        ? 'メールアドレスを入力してください。登録状況にかかわらず同じ案内を表示し、この端末で15分以内に新しいパスワードを設定できます。'
        : 'メールアドレスを入力してください。登録状況にかかわらず同じ案内を表示し、登録済みの場合は15分間有効な再設定リンクを送信します。'}),
    );

    const requestMessage = element('p', {className:'form-message'});
    requestMessage.id = 'password-reset-request-message';
    setAnnouncementState(requestMessage);
    const requestForm = element('form', {className:'auth-form password-reset-request'});
    const emailLabel = element('label', {text:'登録済みメールアドレス'});
    const email = element('input', {type:'email'});
    email.name = 'reset-email';
    email.autocomplete = 'email';
    email.required = true;
    email.disabled = !requestAvailable;
    email.setAttribute('aria-describedby', requestMessage.id);
    emailLabel.append(email);
    const requestButton = element('button', {type:'submit', text:'再設定手続きを続ける'});
    requestButton.disabled = !requestAvailable;
    requestForm.append(emailLabel, requestButton, requestMessage);

    const confirmMessage = element('p', {className:'form-message'});
    confirmMessage.id = 'password-reset-confirm-message';
    setAnnouncementState(confirmMessage);
    const confirmForm = element('form', {className:'auth-form password-reset-confirm'});
    confirmForm.hidden = !linkedReset;
    const passwordLabel = element('label', {text:'新しいパスワード（12文字以上）'});
    const password = element('input', {type:'password'});
    password.name = 'new-password';
    password.autocomplete = 'new-password';
    password.minLength = 12;
    password.required = true;
    password.disabled = !confirmAvailable;
    password.setAttribute('aria-describedby', confirmMessage.id);
    passwordLabel.append(password);
    const confirmationLabel = element('label', {text:'新しいパスワード（確認）'});
    const confirmation = element('input', {type:'password'});
    confirmation.name = 'new-password-confirmation';
    confirmation.autocomplete = 'new-password';
    confirmation.minLength = 12;
    confirmation.required = true;
    confirmation.disabled = !confirmAvailable;
    confirmation.setAttribute('aria-describedby', confirmMessage.id);
    confirmationLabel.append(confirmation);
    const confirmButton = element('button', {type:'submit', text:'パスワードを更新'});
    confirmButton.disabled = !confirmAvailable;
    confirmForm.append(passwordLabel, confirmationLabel, confirmButton, confirmMessage);

    if (!available) {
      announce(requestMessage, capabilities?.environment === 'production' && sessionReachable
        ? 'パスワード再設定メールの受付は現在準備中です。ご利用ガイドのお問い合わせ窓口をご確認ください。'
        : '会員サービスに接続できないため、現在パスワードを再設定できません。', true);
    } else if (resetState === 'invalid') {
      announce(confirmMessage, '再設定リンクの有効期限が切れているか、すでに使用されています。もう一度メール送信からやり直してください。', true);
    }

    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!requestAvailable || !requestForm.checkValidity()) {
        if (requestAvailable) requestForm.reportValidity();
        return;
      }
      requestButton.disabled = true;
      announce(requestMessage, '登録状況を確認しています。');
      try {
        await client().requestPasswordReset(email.value);
        if (localReset) {
          confirmForm.hidden = false;
          announce(requestMessage, '再設定手続きを受け付けました。確認情報はこのブラウザで安全に保持されます。15分以内に新しいパスワードを設定してください。');
          password.focus();
        } else {
          announce(requestMessage, '再設定手続きを受け付けました。登録済みの場合は、15分以内に再設定メールが届きます。');
        }
      } catch (error) {
        announce(requestMessage, isServiceUnavailable(error)
          ? '会員サービスに接続できません。時間をおいてから、もう一度お試しください。'
          : '再設定手続きを開始できませんでした。入力内容をご確認ください。', true);
      } finally {
        requestButton.disabled = !requestAvailable;
      }
    });

    confirmForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!confirmAvailable) return;
      if (!confirmForm.checkValidity()) {
        confirmForm.reportValidity();
        return;
      }
      if (password.value !== confirmation.value) {
        announce(confirmMessage, '確認用パスワードが一致していません。', true);
        confirmation.focus();
        return;
      }
      confirmButton.disabled = true;
      announce(confirmMessage, 'パスワードを更新しています。');
      try {
        await client().confirmPasswordReset(password.value);
        password.value = '';
        confirmation.value = '';
        announce(confirmMessage, '再設定手続きを完了しました。登録済みのアカウントは、新しいパスワードでログインできます。');
        if (!localReset && globalThis.history?.replaceState) {
          globalThis.history.replaceState({}, '', './account.html');
        }
      } catch (error) {
        announce(confirmMessage, error.code === 'RESET_TOKEN_EXPIRED_OR_USED'
          ? '再設定手続きの有効期限が切れているか、すでに完了しています。最初からやり直してください。'
          : isServiceUnavailable(error)
            ? '会員サービスに接続できません。時間をおいてから、もう一度お試しください。'
            : 'パスワードを更新できませんでした。入力内容をご確認ください。', true);
      } finally {
        confirmButton.disabled = false;
      }
    });

    const returnButton = element('button', {className:'text-button', type:'button', text:'ログイン画面へ戻る'});
    returnButton.addEventListener('click', onReturnToLogin);
    section.append(requestForm, confirmForm, returnButton);
    return section;
  }

  function renderActions() {
    const host = $('#authActions');
    host.replaceChildren();
    if (session.authenticated) {
      const logout = element('button', {className:'logout-button', type:'button', text:'ログアウト'});
      const feedback = element('p', {className:'form-message'});
      setAnnouncementState(feedback);
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        announce(feedback, 'ログアウトしています。');
        try {
          await client().logout();
          localStorage.removeItem('kisaragi-shop-demo-cart-v1');
          await refreshSession();
        } catch {
          announce(feedback, 'ログアウトできませんでした。もう一度お試しください。', true);
          logout.disabled = false;
        }
      });
      host.append(logout, feedback);
      return;
    }

    const tabs = element('div', {className:'auth-tabs'});
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '会員手続き');
    const loginTab = element('button', {type:'button', text:'ログイン'});
    const registerTab = element('button', {type:'button', text:'会員登録'});
    const resetTab = element('button', {type:'button', text:'パスワード再設定'});
    [loginTab, registerTab, resetTab].forEach((tab) => tab.setAttribute('role', 'tab'));
    const formHost = element('div');
    const select = (mode) => {
      [[loginTab, 'login'], [registerTab, 'register'], [resetTab, 'reset']].forEach(([tab, tabMode]) => {
        const selected = mode === tabMode;
        tab.setAttribute('aria-pressed', String(selected));
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      formHost.replaceChildren(mode === 'reset' ? createPasswordResetForm(() => {
        select('login');
        loginTab.focus();
      }) : createAuthForm(mode));
    };
    loginTab.addEventListener('click', () => select('login'));
    registerTab.addEventListener('click', () => select('register'));
    resetTab.addEventListener('click', () => select('reset'));
    tabs.append(loginTab, registerTab, resetTab);
    host.append(tabs, formHost);
    const initialMode = new URLSearchParams(globalThis.location?.search || '').get('mode') === 'reset' ? 'reset' : 'login';
    select(initialMode);
  }

  function clearSensitiveSessionView(message = '会員情報を再確認しています。') {
    refreshGeneration += 1;
    session = {authenticated:false};
    sessionReachable = false;
    renderSession();
    renderAgeVerification();
    renderMemberProfile();
    renderOrders([]);
    renderTracking([]);
    renderActions();
    announce($('#orderHistory'), message);
    announce($('#trackingContent'), message);
  }

  async function refreshSession() {
    const generation = ++refreshGeneration;
    let nextSession;
    let reachable = true;
    try {
      nextSession = await client().session();
    } catch {
      nextSession = {authenticated:false};
      reachable = false;
    }
    if (generation !== refreshGeneration) return;
    session = nextSession;
    sessionReachable = reachable;
    renderSession();
    renderAgeVerification();
    renderMemberProfile();
    renderActions();
    if (!session.authenticated) {
      renderOrders([]);
      renderTracking([]);
      return;
    }
    announce($('#orderHistory'), '注文履歴を読み込んでいます。');
    announce($('#trackingContent'), '配送情報を読み込んでいます。');
    try {
      const payload = await client().orders();
      if (generation !== refreshGeneration) return;
      renderOrders(payload);
      renderTracking(payload);
    } catch {
      if (generation !== refreshGeneration) return;
      $('#ordersChip').textContent = '確認できません';
      $('#trackingChip').textContent = '確認できません';
      announce($('#orderHistory'), '注文履歴を読み込めませんでした。', true);
      announce($('#trackingContent'), '配送情報を読み込めませんでした。', true);
    }
  }

  function scheduleExternalSessionRefresh() {
    clearSensitiveSessionView();
    const refresh = refreshSession();
    externalRefreshPromise = refresh;
    return refresh.finally(() => {
      if (externalRefreshPromise === refresh) externalRefreshPromise = null;
    });
  }

  function failClosed() {
    capabilities = null;
    session = {authenticated:false};
    sessionReachable = false;
    renderSession();
    renderAgeVerification();
    renderMemberProfile();
    renderOrders([]);
    renderTracking([]);
    renderActions();
  }

  function restoreLocationHash() {
    const id = decodeURIComponent(String(globalThis.location?.hash || '').replace(/^#/, ''));
    const target = id ? document.getElementById(id) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView({block:'start'}));
  }

  async function init() {
    if (!client()?.configured) {
      failClosed();
      restoreLocationHash();
      return;
    }
    try {
      capabilities = await client().capabilities();
      await refreshSession();
    } catch {
      failClosed();
    }
    restoreLocationHash();
  }

  globalThis.addEventListener?.('storage', (event) => {
    if (event.key === client()?.sessionRevisionKey) scheduleExternalSessionRefresh();
  });
  globalThis.addEventListener?.('pageshow', scheduleExternalSessionRefresh);
  globalThis.addEventListener?.('focus', scheduleExternalSessionRefresh);
  globalThis.document?.addEventListener('visibilitychange', () => {
    if (globalThis.document.visibilityState === 'visible') scheduleExternalSessionRefresh();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
