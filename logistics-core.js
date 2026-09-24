(() => {
  'use strict';

  const shippingMethods = Object.freeze([
    Object.freeze({id:'yamato', name:'ヤマト運輸（宅急便）', fee:800, leadTime:'2〜4日', integration:'B2 Cloud API'}),
    Object.freeze({id:'sagawa', name:'佐川急便（飛脚宅配便）', fee:750, leadTime:'2〜4日', integration:'スマートAPI'}),
    Object.freeze({id:'japanpost', name:'日本郵便（ゆうパック）', fee:800, leadTime:'2〜4日', integration:'法人向け送り状連携'})
  ]);

  const timeSlots = Object.freeze([
    Object.freeze({id:'none', label:'指定なし（最短お届け希望）'}),
    Object.freeze({id:'morning', label:'午前中'}),
    Object.freeze({id:'14-16', label:'14:00〜16:00'}),
    Object.freeze({id:'16-18', label:'16:00〜18:00'}),
    Object.freeze({id:'18-20', label:'18:00〜20:00'}),
    Object.freeze({id:'19-21', label:'19:00〜21:00'})
  ]);

  const integrations = Object.freeze([
    Object.freeze({id:'yamato', name:'ヤマト運輸向け連携インターフェース', status:'INTERFACE_READY'}),
    Object.freeze({id:'sagawa', name:'佐川急便向け連携インターフェース', status:'INTERFACE_READY'}),
    Object.freeze({id:'japanpost', name:'日本郵便向け連携インターフェース', status:'INTERFACE_READY'})
  ]);

  const shippingMethod = (methodId) => shippingMethods.find((method) => method.id === methodId) || shippingMethods[0];

  function calculateQuote({methodId, subtotal = 0, hasUnknownPrice = false} = {}) {
    const method = shippingMethod(methodId);
    const knownSubtotal = Math.max(0, Number(subtotal) || 0);
    return Object.freeze({
      method,
      knownSubtotal,
      shippingFee:method.fee,
      knownGrandTotal:knownSubtotal + method.fee,
      hasUnknownPrice:Boolean(hasUnknownPrice),
      provisional:true
    });
  }

  function validateAddress(address = {}) {
    const required = ['recipientName', 'phone', 'postalCode', 'prefecture', 'addressLine'];
    if (required.some((key) => !String(address[key] || '').trim())) {
      return {valid:false, message:'氏名・電話番号・郵便番号・都道府県・住所を入力してください。'};
    }
    if (!/^\d{3}-?\d{4}$/.test(String(address.postalCode).trim())) {
      return {valid:false, message:'郵便番号は 123-4567 の形式で入力してください。'};
    }
    const phoneDigits = String(address.phone).replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return {valid:false, message:'電話番号は市外局番を含む10〜11桁で入力してください。'};
    }
    return {valid:true};
  }

  function getAvailableDeliveryDates(baseDate = new Date()) {
    const dates = [];
    for (let offset = 3; offset <= 10; offset += 1) {
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offset);
      const value = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
      dates.push(Object.freeze({value, label:`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${weekday}）`}));
    }
    return Object.freeze(dates);
  }

  globalThis.KISARAGI_LOGISTICS = Object.freeze({
    shippingMethods,
    timeSlots,
    integrations,
    calculateQuote,
    validateAddress,
    getAvailableDeliveryDates
  });
})();
