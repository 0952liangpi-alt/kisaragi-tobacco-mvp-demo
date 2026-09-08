(() => {
  const $ = (selector) => document.querySelector(selector);
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const cartKey = 'kisaragi-shop-demo-cart-v1';
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const deliveryLabels = { 'age-check':'年齢確認付き配送', standard:'通常配送' };
  const paymentLabels = { card:'クレジットカード', konbini:'コンビニ払い', bank:'銀行振込', cod:'代金引換' };
  let items = [];
  function restore(){try{const ids=JSON.parse(localStorage.getItem(cartKey)||'[]');items=ids.map((id)=>catalog().find((item)=>item.id===id)).filter(Boolean)}catch{items=[]}}
  function renderSummary(){const host=$('#selectionItems');const total=items.reduce((sum,item)=>sum+Number(item.price_jpy||item.price||0),0);$('#selectionTotal').textContent=yen(total);if(!items.length){host.innerHTML='<p class="empty">選択リストに商品がありません。商品案内から追加してください。</p>';return}host.innerHTML=items.map((item)=>`<article class="selection-line"><p><b>${item.product_name_ja||item.name||'商品名確認中'}</b></p><small>${item.product_code||item.sku||'品番確認中'}</small><strong>${Number(item.price_jpy||item.price||0)?yen(item.price_jpy||item.price):'価格確認中'}</strong></article>`).join('')}
  function clearError(){document.querySelectorAll('.error').forEach((node)=>node.remove())}
  function error(message){const node=document.createElement('p');node.className='error';node.textContent=message;$('#applicationForm').append(node)}
  function preview(event){event.preventDefault();clearError();if(!items.length){error('先に商品案内から商品を選択してください。');return}const data=new FormData(event.currentTarget);const required=['nameKanji','nameKana','email','phone','postalCode','prefecture','addressLine'];if(required.some((name)=>!String(data.get(name)||'').trim())||!data.get('adultConsent')){error('必須項目と20歳以上の確認を入力してください。');return}const building=String(data.get('building')||'').trim();const address=`〒${data.get('postalCode')} ${data.get('prefecture')}${data.get('addressLine')}${building?` ${building}`:''}`;const details=[['氏名',data.get('nameKanji')],['フリガナ',data.get('nameKana')],['配送希望',deliveryLabels[data.get('delivery')]],['支払い希望',paymentLabels[data.get('payment')]],['お届け先',address]];$('#confirmationBody').innerHTML=`<div class="confirmation-list">${details.map(([label,value])=>`<p><b>${label}</b><br>${String(value)}</p>`).join('')}</div>`;$('#confirmation').hidden=false;$('#closeConfirmation').focus()}
  function fillAddress(){const code=$('[name="postalCode"]').value.replace(/[^0-9]/g,'');if(code==='1000001'){$('[name="prefecture"]').value='東京都';$('[name="addressLine"]').value='千代田区千代田';return}if(code==='1500001'){$('[name="prefecture"]').value='東京都';$('[name="addressLine"]').value='渋谷区神宮前';return}error('例示の住所補完です。郵便番号 100-0001 または 150-0001 で確認できます。')}
  function init(){restore();renderSummary();$('#applicationForm').addEventListener('submit',preview);$('#fillAddress').addEventListener('click',fillAddress);$('#closeConfirmation').addEventListener('click',()=>{$('#confirmation').hidden=true})}
  window.addEventListener('DOMContentLoaded',init);
})();
